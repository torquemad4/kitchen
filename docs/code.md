# Clousto — Code Reference

Technical documentation of the codebase. For architecture and the data model see
[`architecture.md`](architecture.md); for how it is used see
[`user-guide.md`](user-guide.md).

---

## 1. Repository layout

```
~/projects/kitchen/
├── public/index.html      ⭐ THE ENTIRE APP. One file. No build step, no framework.
├── functions/api/
│   ├── week.js            GET/PUT the published week
│   ├── state.js           GET/POST tick + pick sync
│   ├── recipe.js          GET one cook card
│   ├── recipes.js         GET the recipe library          (new, 7 Sep 2026)
│   ├── pantry.js          GET the pantry                  (new, 7 Sep 2026)
│   ├── stock.js           GET ingredients ⋈ pantry        (stage B, 7 Sep 2026)
│   └── cook.js            POST what happened at the hob
├── schema.sql             the D1 schema, applied by deploy.sh
├── seed-week.mjs          week-seed.json ─► seed.sql
├── cook-cards/*.json      hand-authored cook cards (3)
├── app.conf               ⭐ the ONLY per-app file
├── deploy.sh  access.mjs  domain.mjs   ⛔ identical across every app — never edit per-app
└── docs/
```

### The platform files

`deploy.sh`, `access.mjs` and `domain.mjs` are **byte-identical across Clousto, Clint
and Iron Log**. If you find yourself editing one for this app, the thing you actually
want is a new variable in `app.conf`.

```bash
PROJECT=kitchen-torquemada        # Cloudflare Pages project
APP_HOST=kitchen.torquemada.uk
D1_DATABASE="clousto"             # schema.sql is applied to it if present
KV_BINDINGS=""                    # no KV: the week is relational, not a blob
```

---

## 2. API surface

All endpoints return JSON with `cache-control: no-store`. The week changes under the
page and an aisle list must never be stale.

| method | path | purpose |
|---|---|---|
| `GET` | `/api/week` | the live week, or `?id=` for a past one |
| `PUT` | `/api/week` | publish a built week |
| `GET` | `/api/state?week=` | shared tick + pick state |
| `POST` | `/api/state` | a batch of tick/pick events from one phone |
| `GET` | `/api/recipes` | the whole library; `?id=` / `?name=` for one |
| `GET` | `/api/pantry` | the pantry; `?level=` to filter |
| `GET` | `/api/stock` | ⭐ stage B: `ingredients` ⋈ `pantry`, keyed by every name a week might use |
| `GET` | `/api/recipe?name=` | the structured **cook card** (`recipes.cook`) |
| `POST` | `/api/cook` | a finished cook → `cook_log` |

### `week.js`

`PUT` **refuses a partial week** with `422` and a list of problems. A shopping list
missing a slot renders as a plausible, wrong list, and the person holding it is
standing in an aisle. It requires `packs`, `slots`, `choices`, and **at least two
options per slot — three is the rule**.

Publishing `status:"live"` closes any other live week in the same batch, upholding the
one-live-week invariant at the application layer as well as the index.

A `doc` that will not `JSON.parse` returns `500` rather than rendering. Same reasoning.

### `state.js`

The concurrency core. Read it before touching anything about sync.

```sql
INSERT INTO cart_state (...) VALUES (...)
ON CONFLICT(week_id, item_key) DO UPDATE SET ...
WHERE excluded.ts > cart_state.ts        -- ⭐ last-write-wins, enforced in SQL
```

⭐ **The `WHERE excluded.ts > …` clause is the whole design.** Last-write-wins is done
in SQL rather than by read-then-write, so two phones draining simultaneously cannot
interleave into a lost update. `ts` is the **client's** clock, in ms.

Batched (`MAX_EVENTS = 500`): a drain after a dead spot is one request, not thirty.

### `recipes.js` and `pantry.js` (added 7 Sep 2026)

`recipes.js` returns `method` **verbatim and whole**. Do not add truncation,
summarising or "tidying" — see the invariant in `architecture.md` §7.4.

`pantry.js` computes `weakEvidence` (`how_checked` ∈ {recalled, inferred}) server-side
and returns the counts alongside the rows, so the page and the API cannot disagree
about how many rows are shaky.

The whole library is served in one response deliberately — one fetch that works beats
six that fail in an aisle.

---

## 3. `public/index.html`

~1,400 lines: a `<style>` block, a `<script type="application/json">` shell, and one
`<script>` holding the app. No framework, no bundler, no dependencies.

### 3.1 Rendering model

**Full re-render on every change.** `render()` rebuilds `#app` from `CONTENT` + `STATE`
as a single `innerHTML` assignment. There is no diffing and no component tree.

```js
const TABS = [ {id, label, fn}, … ];   // fn() returns an HTML string
render() → header + nav + TABS.map(t => '<section>' + t.fn() + '</section>')
```

Every `view*()` function is a **pure string builder**. Adding a tab is one entry in
`TABS` plus one function. `render()` is deterministic: called twice with unchanged
state it produces byte-identical output — a useful property when testing.

⚠️ **`esc()` everything.** Text originates in Notion and goes in via `innerHTML`.

### 3.2 State and sync

```js
STATE = { checked: [ …itemKeys ], picks: { slotKey: optionIdx } }
```

- `readState()` / `saveLocal()` — localStorage, keyed `clousto.week.<weekId>`.
- `queueEvent()` → `loadQueue()`/`saveQueue()` — the **offline outbox**, keyed
  `clousto.queue.<weekId>`. Ticks land here first, always.
- `flush()` — drains the queue to `POST /api/state`.
- `pullState()` — takes the other phone's state.

⭐ **Order matters at boot: `flush()` then `pullState()`.** Our queue is newer than the
server; pulling first would overwrite local changes that had not been sent yet.

Re-triggered on `online` and on `visibilitychange`.

### 3.3 The cart builder

```
ingredientNeed()  →  { packKey: qtyNeeded }   summed across all picks,
                                              plus CONTENT.fixed and CONTENT.floor
effectiveCart()   →  need − CONTENT.held → ceil(short / pack.size) → priced lines
```

⚠️ **The QUANTITIES are still the week blob's.** `CONTENT.held` is a hand-made snapshot of
the pantry frozen into `weeks.doc` and `CONTENT.packs` is this week's products. That
remains true because a numeric diff needs `pantry.qty`, which does not exist — pantry
amounts are free text on purpose. What stage B added is a **truth layer** over that
arithmetic; see `heldFor()` below and `architecture.md` §2.1.

`CONTENT.floor` is added to the *need*, so the emergency floor is a requirement the
cart cannot leave the house below.

⭐ **`heldFor(k)` is stage B, and it is a BINARY judgement.** `CONTENT.held` is a hand-made
snapshot frozen into the week; `/api/stock` is the live answer. `out`, `low` and
`unmeasured` all return 0 — we do not know there is enough, so the line goes on the list.
`ok` and `plenty`, or no pantry row at all, keep the week's number.

⛔ **No advisory UI. Ever.** See `architecture.md` §2.1 for Karl's rule. A first cut of
this added a warnings panel and was rejected: the Shop tab's own copy says *"nothing here
is a maybe"*. If something needs attention it is a line, or it is not there.

**An ingredient with no pack still emits a line** — `effectiveCart()` pushes it into
`Cupboard` with `p: null`, its quantity, and no price. `cartTotal()`/`remainingTotal()`
coalesce `i.p || 0`; the renderer omits the price span when `i.p == null`. It ticks like
any other line and enters the offline outbox normally. The unit comes from
`recipe_ingredients` via `/api/stock`, never guessed.

⚠️ With `STOCK` null — offline, first visit, endpoint down — the cart is byte-identical to
before stage B. There is a regression check for that.

### 3.4 The library module (added 7 Sep 2026)

```js
LIBRARY, PANTRY                    // in memory
loadLibrary(), loadPantry()        // cache-first, then network, re-render on arrival
libKey(), libTokens(), libFind()   // the week ─► library join
mdInline(), mdToHtml()             // verbatim markdown ─► HTML
libraryBody()                      // ⭐ a METHOD SECTION, not a card — see below
viewPantry()                       // the Pantry tab
```

#### ⭐ `libraryBody()` augments the week card; it does not replace it

The week card renders everything that is true only *this* week — the `meta` line, the
lead, the week notes, the **Karl 3/5 · Maria 2/5 plates**, the split bar, the whole-dish
ingredients and the equipment list. The library holds the canonical dish. **Only the
Method section is swapped.**

> ⛔ **The first version of this was a whole card** built from the library, with the
> week's fields re-added one at a time. It silently dropped the plates, then the week
> notes, then the option's warning — each found only by going looking. **That shape is a
> denylist: it preserves whatever someone happened to think of.** Never rebuild the
> card; augment it.

`libraryBody()`'s output is wrapped in `.libbody` **so the invariant is testable**:
strip `.libbody` and the card must be byte-identical to what the page rendered before
the library existed. There is a regression check for exactly this (§5).

The one intentional difference: on a swapped pick, the *"not written yet"* banner is
suppressed when the library does have a method — because it is no longer true.

The full body is rendered **unsliced**, including its own `## Ingredients`, which
duplicates the week card's list. That is deliberate: duplication is a cosmetic cost,
dropping a line is a defect, and this kitchen has already cooked a compressed card.

**Cache-first**: read `localStorage` and render immediately, then fetch and correct.
Keys `clousto.library.v1`, `clousto.pantry.v1`. ⚠️ Bump the `.v1` suffix if the payload
shape changes, or returning phones will render stale objects against new code.

#### `libFind()` — the join, and why it is deliberately conservative

The week document carries **abbreviated** option labels: *"Goan coconut fish curry with
rice"* for the library's *"…with lentil rice"*; *"Kung pao chicken"* for *"Kung
pao-**style** chicken"*. Exact matching resolved only **5 of 12** dinner options.

The rule is: exact match first; otherwise **every significant word in the week's label
must appear in the library title, and exactly one row may qualify.** Ambiguity resolves
to *no match* and the previous behaviour.

> ⛔ **Do not make this fuzzy.** Two library recipes differ only in their last two words
> — *Sesame-peanut noodles with crisp chilli **CHICKEN*** and *…with crisp chilli **tofu
> crumble***. Serving the wrong card on the wrong night is far worse than serving none.
> There is a regression test for exactly this pair; see §5.

#### `mdToHtml()`

Handles the subset Notion emits: `##` headings, `-` bullets, `1.` ordered lists,
`**bold**`, `*italic*`, `` `code` ``, `>` quotes, `---`, links, and Notion's backslash
escapes (`\~880` → `~880`). Escapes HTML **before** introducing any tag.

⭐ **Bold is rendered, never stripped.** In these recipes it marks what ruins the dish.

### 3.5 Cook mode

`openCook(name)` → `GET /api/recipe?name=` → `recipes.cook` (JSON) → four phases:
what to get out, what to get ready, prep, then steps with per-step timers.
`saveCook()` → `POST /api/cook` → `cook_log`, and reports elapsed vs estimated.

Only 3 recipes have a `cook` card (`cook-cards/*.json`). The other 33 fall back to the
verbatim method on the Recipes tab.

🔴 Stages C and D (pre-cook checks, confirm + pantry decrement) attach here.

---

## 4. Deploying

⛔ **There is no CI. Pushing to `main` deploys nothing.**

```bash
bash deploy.sh          # full: Pages + D1 schema + Cloudflare Access
```

Narrow deploy — the exact step from inside `deploy.sh`, without re-provisioning Access
or re-applying `schema.sql`:

```bash
npx wrangler pages deploy public --project-name kitchen-torquemada --commit-dirty=true
```

Confirm it became **Production** (not a preview) — this is easy to get wrong:

```bash
npx wrangler pages deployment list --project-name kitchen-torquemada
```

Rollback: redeploy a previous deployment from the Cloudflare dashboard.

### Publishing a week

```bash
node seed-week.mjs week.json 2026-08-30 "Sun 30 Aug – Mon 7 Sep 2026" > seed.sql
npx wrangler d1 execute clousto --remote --file=./seed.sql -y
```

---

## 5. Local development and testing

```bash
npx wrangler pages dev --port 8788 --ip 127.0.0.1
```

⚠️ `wrangler pages dev` binds **local** D1 by default — an empty database. Seed it:

```bash
npx wrangler d1 execute clousto --local -y --file=./schema.sql
npx wrangler d1 execute clousto --local -y --file=./seed.sql      # a week
# plus any data files
```

This gives a full local mirror of production data with **zero risk to the live week**,
and is the right place to test anything touching `weeks`, `picks` or `cart_state`.

### Checks worth running before any deploy

```bash
# 1. Syntax-check the inline app script (it is not covered by any linter)
python3 -c "import re;h=open('public/index.html').read();\
open('/tmp/app.js','w').write(re.findall(r'<script>\n(.*?)</script>',h,re.S)[-1])"
node --check /tmp/app.js

# 2. Syntax-check the functions
for f in functions/api/*.js; do cp $f /tmp/c.mjs && node --check /tmp/c.mjs || echo $f; done
```

**In-browser regression checks** (run in the console against a seeded local server):

| check | expected |
|---|---|
| every dinner option resolves | `CONTENT.choices` → `libFind(o.n)` → 12/12 with a method |
| the dangerous pair does not cross-match | `libFind('…chilli CHICKEN')` ≠ `libFind('…tofu crumble')` |
| a vague name is rejected | `libFind('noodles')` → `null` |
| markdown fidelity | `<b>` count === source `**` pairs ÷ 2 |
| render is deterministic | `render(); a=html; render(); b=html; a===b` |
| every pick permutation renders | all 12 combinations, no exceptions, no empty cards |
| fallback | with `LIBRARY = null`, the page renders exactly as before |
| ⭐ **the week card is only augmented** | strip `.libbody` with the library on, strip `ol.steps` + the `Method` grouptitle with it off, and the two must be **byte-identical** (allowing for the intentionally suppressed "not written yet" banner) |

---

## 6. History worth keeping

**7 Sep 2026 — the recipe library and pantry came out of Notion.** 36 recipes with their
verbatim method and 56 pantry rows landed in D1; `recipes.js` and `pantry.js` were added
and the Recipes tab was rewired to read them, with a new Pantry tab alongside.

⚠️ **The first deploy that day (`751ea33a`) shipped a regression** and it is worth
remembering how. `viewRecipes()` was changed to build a *fresh card from the library*,
which silently dropped the per-person plates block from two cards. The fix attempt made
it worse — plates, then week notes, then the option warning, each re-added only after
someone went looking for the next missing thing.

⭐ **The rewrite inverted it**: keep the week card, swap only the Method section
(`libraryBody()`, §3.4). Net −21 lines, and the "nothing week-specific is lost" property
became a regression check rather than a claim.

> **The general lesson, which applies well beyond this function:** when new data supersedes
> part of an existing view, replace *that part*. Rebuilding the view from the new source
> and re-adding the old fields is a denylist, and denylists lose exactly the things nobody
> remembered to list.
