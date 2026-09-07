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

⭐ **It also refuses a week that cannot be shopped**: every key in `held` must have a
`packs` entry. Held stock runs out after publication, and a shortfall has to become a line
with a size and a price. A pack entry is a catalogue entry, not a line — it costs nothing
until the pantry says that item is short.

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

**The tabs, in order: Shop · The week · Choose · Slots · Recipes · Pantry.** There is
no Receipt tab — stage E is a Cowork conversation, not a screen.

#### ⭐ The lock: choosing is a phase, not a permanent control

```js
const LOCK_KEY = "_locked";        // stored as a pick, so it syncs like one
isLocked() / setLocked(v)
```

Once the week is locked, **everything not chosen is hidden**: Choose and Slots collapse
to what was picked, and the Shop tab stops offering alternatives. Karl, 7 Sep: *"once
recipes/slots are locked in, everything not chosen should be hidden."* Deciding and
shopping are different jobs and the second one does not want the first one's options
still on screen.

⭐ It rides on the pick channel deliberately — one sync path, one conflict rule, and
both phones lock together.

#### Responsive

The page is **mobile-first and must also work on a laptop**. Layout widens at the
breakpoint rather than reflowing into something different; the aisle case is still the
one that gets the tight column.

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
PICKKEYS() / SLOTKEYS() / ALLKEYS()   ⭐ derived from the document, never hardcoded
ingredientNeed()  →  { packKey: qtyNeeded }   each picked option's OWN `use` map
                                              (× days for a slot), + fixed + floor
effectiveCart()   →  need − heldFor() → ceil(short / pack.size) → priced lines
```

⭐ **A changed pick moves the trolley.** Every option in the regenerated week carries its
own `use` map, so `ingredientNeed()` sums what was actually chosen rather than reading a
frozen list. Before that the cart was the same whatever you picked, which made choosing
decorative.

⛔ **The key sets are derived.** `PICKKEYS()`, `SLOTKEYS()` and `ALLKEYS()` walk
`CONTENT`. A hardcoded list silently omits whatever stage A adds next, and the omission
looks exactly like a finished shopping list.

`CONTENT.floor` is added to the *need*, so the emergency floor is a requirement the
cart cannot leave the house below.

⭐ **`heldFor(k)` reconciles the week against the pantry, and only `out` wins.**

```js
if (!held) return 0;                              // nothing claimed
if (!st || !st.tracked) return held;              // no live row
if (!CONTENT.built || !st.lastChecked) return held;
if (CONTENT.built > st.lastChecked) return held;  // the week is fresher
return st.level === "out" ? 0 : held;             // only "none" beats a number
```

A tie goes to the pantry: a row checked the day the week was built is at least as
current. ⚠️ **`low` does not zero a stated quantity.** `low` is a bucket and `held` is a
number; 300 g of oats *is* low, and they agree rather than conflict. Treating them as a
conflict put oats, peanut butter and soy sauce back on the list for £1.94. `out` says
*none*, and none beats any number.

⛔ **`effectiveCart()` never drops an aisle group.** Known aisles keep the walking order;
anything unknown is appended. A builder that walked only the aisles it recognised would
have silently dropped the £40 lamb and the wines from the live week.

⛔ **No advisory UI. Ever.** See `architecture.md` §2.1 for Karl's rule. A first cut of
this added a warnings panel and was rejected; so was the follow-up that emitted a
half-line stating a requirement instead of a purchase. The Shop tab's own copy says
*"nothing here is a maybe"*. If something needs attention it is a line, or it is not
there.

**No pack, no line.** `effectiveCart()` keeps `if(!p) continue;` — every line carries a
size and a price by construction, so there is no null-price path and no defensive
coalescing anywhere. The condition that would need one is refused at publish instead:
`PUT /api/week` rejects a week where a `held` key has no `packs` entry (§`week.js`).

⚠️ With `STOCK` null — offline, first visit, endpoint down — the cart is byte-identical to
before stage B. There is a regression check for that.

### 3.4 The library module (added 7 Sep 2026)

```js
LIBRARY, PANTRY                    // in memory
loadLibrary(), loadPantry()        // cache-first, then network, re-render on arrival
libKey(), libTokens(), libFind()   // the week ─► library join
mdInline(), mdToHtml()             // verbatim markdown ─► HTML
libraryBody()                      // ⭐ a METHOD SECTION, not a card — see below
viewRecipes(), todaysKey()         // the Recipes tab — ONE recipe, sub-tab selected
viewPantry()                       // the Pantry tab — a table
```

#### The Recipes tab shows exactly one recipe

A second row of sub-tabs selects it, and `todaysKey()` defaults to whatever is being
cooked on the day you are looking — dinner preferred when a day has more than one.
Karl, 7 Sep: *"The recipe tab should have only one recipe on it at any time."* Six
cards stacked on a phone is a scroll, not a page you can cook from.

#### The Pantry tab is a table, not prose

Four columns: **Item · Amount · Certainty · Checked.** Rows with `level = "out"` are
filtered out, because an empty jar is not stock and the page only ever says what is in
the house. ⛔ No `NEVER HELD`, no provenance paragraphs, no "never reorder" copy —
Karl asked for all of it gone. The provenance is still in D1; `/api/pantry` still
returns it. It is simply not what this page is for.

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

Only 3 recipes have a `cook` card (`cook-cards/*.json`). The other 35 fall back to the
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
| ⭐ **no aisle group is dropped** | the groups `effectiveCart()` emits ⊇ every group present in `CONTENT.packs` for a needed key — this is what protects the £40 lamb and the wines |
| ⭐ **a changed pick moves the cart** | flip any pick and the totals must change; two different picks giving an identical cart means `ingredientNeed()` has stopped reading `use` |
| **`low` does not zero a stated quantity** | with `STOCK` saying `low` for a key the week holds, that key must still produce **no** line; only `out` does |
| **the declaration list is intact** | `git diff HEAD -- public/index.html \| grep -c '^-.*\bfunction '` — an over-broad replacement has twice deleted whole modules; anything non-zero must be deliberate |
| **locked hides the unchosen** | `setLocked(true); render()` → no unpicked option appears anywhere in the HTML |
| **the Recipes tab shows one recipe** | exactly one `.card` in that section, whatever the day |
| **the Pantry tab says only what we have** | no row with `level = "out"`, and no occurrence of `NEVER HELD` or `never reorder` |

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

**7 Sep 2026, later — the join, then stage B, then the week of 8 Sep.** `ingredients`
and `recipe_ingredients` were reviewed and signed off, `stock.js` was added, and the
cart began reconciling the week against the live pantry. Clousto then built the 8 Sep
week to the §5.5 contract — every option carrying its own `use` map — and the cart
became computed rather than frozen. It reproduces the document exactly, at **£148.25**.

**7 Sep 2026, later still — the page was corrected to Karl's standards.** Six passes,
and each one removed something rather than adding it: the advisory panel, then the
half-lines, then the pantry's provenance prose, then every mention of what we do not
have, then the unchosen options behind the lock, then five of six recipe cards.

> ⭐ **The pattern is worth naming.** Every rejection was of the same thing — the page
> talking *about* its data instead of just being the answer. `architecture.md` §2.1 and
> `READ-FIRST.md` §1 constraint 3 hold the rule; this is where it was learned.

**Two modules were deleted by over-broad text replacements** in the same session — one
took `libFind`, `mdToHtml` and the `STOCK` cache with it and the page died on load with
`STOCK is not defined`. Both were restored from `HEAD` and the declaration list diffed.
⛔ **Anchor a replacement on both ends, and diff before deploying.**
