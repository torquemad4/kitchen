# READ FIRST — Clousto maintenance guide

**Audience: Claude.** Read this before changing anything in Clousto — code, schema,
data or documentation. It exists so that a change never lands with the documentation
silently left behind.

> ⭐ **The whole point of this file:** in this system, *stale-but-confident* is the
> characteristic failure. It has already happened to a pantry count (3 Sep, caught at
> the pan) and to a recipe card (week 2, cooked compressed and rated "fine"). Documentation
> that has drifted from the code is the same failure in a different medium. **Updating
> the docs is part of the change, not follow-up.**

---

## 1. Sixty-second orientation

Clousto plans the household's food. `kitchen.torquemada.uk`, Cloudflare Pages +
Pages Functions + D1 (`clousto`, `e1268405-4322-460d-9635-6e004c4061dd`), behind
Cloudflare Access. **Load-bearing since 21 Aug 2026** — a broken week has a real cost.

The app is **one HTML file** (`public/index.html`) plus seven Pages Functions. No build
step, no framework, no CI. **Pushing to `main` deploys nothing.**

The loop has five stages: **A** menu creation (Cowork) → **B** picks & shopping list
(app) → **E** receipt (Cowork) → **C** pre-cook checks (app) → **D** cook confirm and
pantry decrement (app). **A and B are built; C, D and E are not** — see
`architecture.md` §2. Stage E is the gap that matters: nothing tells the pantry what
came home from the shop, so its rows drift until someone restates them out loud.

### The three hard constraints behind most design decisions
1. **Offline.** Aldi has poor signal; the aisle is the hostile environment.
2. **Two users at once.** Karl and Maria, two phones. Clousto exists *because*
   concurrent edits were being silently dropped.
3. ⛔ **The page carries no maybes.** Karl, 7 Sep 2026: *"The front end is only for
   shopping, picking, and cooking, nothing more. Don't tell me what went wrong before,
   don't tell me what's uncertain."* Provenance, evidence grading and known failures
   are real and they live in D1 and in these docs — **not on the page.** A decision
   reaches the page as a line or as no line, never as prose about the decision.

---

## 2. The document map

| file | owns | update it when… |
|---|---|---|
| `docs/READ-FIRST.md` | this — orientation and the maintenance contract | the doc set or the invariants change |
| `docs/architecture.md` | the loop, stage ownership, **the data model**, invariants, known-broken | schema changes, a stage is built, an invariant is added |
| `docs/user-guide.md` | what Karl and Maria see and do | user-visible behaviour changes |
| `docs/code.md` | repo layout, endpoints, `index.html` internals, deploy, testing | code changes |
| `docs/ingredient-vocabulary.md` | ✅ The reviewed vocabulary draft, kept for the record. The **live** list is the `ingredients` table; where they differ the table wins. | a new ingredient is agreed |
| `~/projects/skills/clousto/SKILL.md` | safe reading/writing of the D1 | schema or invariants change |
| `~/projects/skills/clousto-menu/SKILL.md` | stage A conversation | the menu flow or its output contract changes |
| `~/projects/skills/clousto-receipt/SKILL.md` | stage E conversation | receipt handling or pantry writes change |
| `README.md` | short front door; points here | the doc set moves |

⛔ **`architecture.md` is the single source of truth for the data model.** If `code.md`
or a skill disagrees with it, `architecture.md` wins and the other is a bug.

---

## 3. Change → documentation matrix

Work down this table for the change you are making. **If a cell says a document is
affected, update it in the same session.**

| you changed… | architecture | user-guide | code | skills | other |
|---|:--:|:--:|:--:|:--:|---|
| a D1 table or column | ✅ §5 | — | if an endpoint shape changed | ✅ `clousto` | `schema.sql` |
| a new API endpoint | — | — | ✅ §2 | ✅ if a skill calls it | — |
| `index.html` view logic | — | ✅ if visible | ✅ §3 | — | — |
| anything the page renders | — | ✅ | ✅ | — | ⛔ re-read §1 constraint 3 first |
| the cart builder | ✅ §4 | ✅ §3 | ✅ §3.3 | — | — |
| the week ↔ library join | — | ✅ §7 if visible | ✅ §3.4 | — | add a regression check |
| built a stage (A–E) | ✅ §2 table **and** flip its 🔴 | ✅ flip its 🔴 | ✅ | ✅ the stage's skill | — |
| a standing rule / floor | ✅ §5.4 | ✅ §8 | — | ✅ | `params` row |
| an invariant | ✅ §7 | — | — | ✅ `clousto` | this file §5 |
| deploy or platform files | — | — | ✅ §4 | — | ⚠️ affects all three apps |
| something known-broken | ✅ §8 | ✅ §7 if visible | — | — | — |

### The status markers are load-bearing

`architecture.md` and `user-guide.md` mark every section ✅ BUILT / 🟡 PARTIAL /
🔴 NOT BUILT. **When you build something, flip its marker.** A 🔴 left on working code
is merely annoying; a ✅ on something unbuilt is the confident-label failure again.

---

## 4. Before you touch data

Read `~/projects/skills/clousto/SKILL.md`. Short version:

- ⭐ **`notion_url` is the upsert key** for `recipes` and `pantry`. UNIQUE indexes
  enforce it. **Never insert blind** — it forks the library under new id slugs, quietly.
- ⛔ **Never touch `weeks`, `picks` or `cart_state`** as part of library or pantry work.
  Verify after any bulk write: `weeks` = 1 live row, `doc` length unchanged.
- ⛔ **The three original stub ids** — `poulet-basquaise`, `stir-fry`, `beef-stout-stew`
  — keep their ids forever. `weeks.doc` and `picks` may reference them.
- ⛔ **`recipes.method` is verbatim.** No truncation, no reformatting, no "tidying".

---

## 5. The invariants, in one list

1. Exactly one week is `live` (partial unique index).
2. `notion_url` is the upsert key; UNIQUE on `recipes` and `pantry`.
3. The three stub recipe ids never change.
4. `recipes.method` is verbatim and complete; the bold is load-bearing.
5. `recipes.cook` is a restructuring of `method`, never the only copy.
6. `weeks` / `picks` / `cart_state` are not collateral damage in other work.
7. One store, not two kept in agreement — **no Notion↔D1 sync job, ever.**
8. No second database, no `_v2` tables — alter the existing schema.
9. Nothing writes back to Clophie (R41).
10. `deploy.sh`, `access.mjs`, `domain.mjs` are identical across all three apps.

---

## 6. Verifying a change

**Code** — see `code.md` §5 for the commands. Minimum before any deploy:
`node --check` the inline app script *and* every function; run the in-browser
regression checks against a **locally seeded** wrangler dev server, never production.

**Data** — after any bulk write:

```sql
SELECT (SELECT COUNT(*) FROM recipes)                        AS recipes,     --  38
       (SELECT COUNT(*) FROM pantry)                         AS pantry,      --  89
       (SELECT COUNT(*) FROM pantry WHERE superseded = 0)    AS live_pantry, --  82
       (SELECT COUNT(*) FROM ingredients)                    AS ingredients, -- 139
       (SELECT COUNT(*) FROM recipe_ingredients)             AS joined,      -- 297
       (SELECT COUNT(*) FROM weeks)                          AS weeks,       --   2
       (SELECT length(doc) FROM weeks WHERE status='live')   AS live_bytes,  -- 40505
       (SELECT COUNT(*) FROM picks)                          AS picks,       --  24
       (SELECT COUNT(*) FROM cart_state)                     AS cart_state;  --   1
```

⚠️ D1 rejects compound `SELECT`s with too many `UNION ALL` terms — use subqueries.

**Deploy** — confirm it became **Production**, not a preview:
`npx wrangler pages deployment list --project-name kitchen-torquemada`.

⚠️ **You cannot verify the live page yourself.** It sits behind Cloudflare Access, which
correctly refuses you (302 to login). Never claim the live page works from a successful
deploy — say what was verified (locally, against real data) and ask Karl to look.

---

## 7. Traps that have already bitten

| trap | what happened |
|---|---|
| **A count with no decrement** | 3 Sep: pastes counted 18 Aug, gone by the pan. *Correct when made.* Stage D fixes it — and creates the mirror trap below. |
| **A decrement is not a check** | If stage D stamps `last_checked`, stage C stops asking and the balance drifts optimistically forever. Use `last_moved` for arithmetic. |
| **Compressed recipe cards** | Week 2 lost the peppers from the stir-fry and the lemon from the salmon. *The dish was not bad — the card was the defect.* |
| **Fuzzy name matching** | Two recipes differ only by *CHICKEN* vs *tofu crumble*. Ambiguity must resolve to no match. |
| **Rebuilding a view from a subset** | ✅ *fixed 7 Sep.* The Recipes tab was rewritten to build a fresh card from the library and re-add the week's fields one at a time; it dropped the per-person plates, and each patch found only the next missing thing. **When new data supersedes part of a view, replace that part — never rebuild the view and re-add the old fields.** A denylist loses exactly what nobody remembered. Now guarded by a regression check (`code.md` §5). |
| **Half-lines on the Shop tab** | The follow-up to the note below: having removed the warnings, a line was emitted carrying the *requirement* ("needs 115 g") with no price. Karl: *"We can't have lines without quantities."* A line says what to put in the trolley. **Every line has a size and a price; anything that cannot is a defect in the week, refused at publish.** |
| **Advisory UI on the Shop tab** | A first cut of stage B added a panel of warnings — "cannot add", "check before you leave". Rejected by Karl, 7 Sep: *"Things are in the list or they are not, we know the quantity or we do not, we put it in the cart or we do not."* The tab's own copy already said *"nothing here is a maybe"*. **Never express a shopping decision as prose; express it as a line, or as no line.** |
| **Deploying to a preview** | `wrangler pages deploy` can land on a preview branch. Always confirm `Environment = Production`. |
| **`--commit-dirty=true`** | The 7 Sep deploy matches no commit. Commit before or immediately after deploying. |
| **Assuming the handover is right** | The 7 Sep handover said `times_cooked` was "0 or null across the board". It was 2,2,2,1,1. **Check the data.** |
| **Reading a closed week as current** | 7 Sep: I read `2026-08-30` — ended — as this week's list. Karl: *"This week's list isn't done yet, you're looking at last week."* **Check `starts_on` against today.** |
| **A pantry row cited as present fact** | 7 Sep: off a row dated 20 Aug I told Karl oats and peanut butter were missing from the cart. Karl: *"They aren't."* This is trap 1 again, aimed at him instead of the pan. **A dated row is evidence of that date, not of now.** |
| **A broad text replacement in `index.html`** | ✅ *fixed 7 Sep, twice.* One over-wide replacement deleted `libFind`, `mdToHtml`, the `STOCK` cache and the whole library module; the page died with `STOCK is not defined`. **Anchor replacements on both ends, and `git diff` the declaration list before deploying.** |
| **Rebuilding the cart from a subset of aisles** | A restored legacy cart builder walked only the aisles it knew and silently dropped the rest — on the live week that was the £40 lamb and the wines. **`effectiveCart()` never drops a group: known aisles keep walking order, unknown ones are appended.** Guarded by a regression check. |
| **A coarse reading overriding a number** | `low` said what the week's `held` number already said, and zeroing on it put oats, peanut butter and soy sauce back on the list for £1.94. **Only `out` beats a stated quantity** — see `architecture.md` §2.1. |

---

## 8. Open decisions — do not invent an answer

These are Karl's to make. If a change depends on one, ask.

1. ~~**The canonical `ingredient_key`.**~~ ✅ **CLOSED 7 Sep** — reviewed and signed off,
   119 rows live in `ingredients`; stage A has since taken it to 139. See
   `architecture.md` §4 for the three things the review corrected, including the
   `pepper` collision.
1b. ~~**Splitting the five food bundle rows.**~~ ✅ **DONE 7 Sep** — pantry 56 → 89 rows,
   nothing left `in_bundle`. Children inherit their parent's evidence; parents kept for
   their history and marked `superseded = 1`, which is what keeps them off the page.
1c. ~~**`salt & pepper`**~~ ✅ **DONE** — `salt` + `black_pepper`. ⛔ Never key the second
   one `pepper`; that is the mixed-peppers pack.
1d. ~~**`red_wine`**~~ ✅ **CLOSED** — Karl, 7 Sep: the paste sachet is long gone.
1e. ~~**35 recipe ingredients with no key.**~~ 🟡 **WORKING AS DECIDED.** Karl, 7 Sep:
   *"Those ingredients will need to be sourced by Clousto next time we pick those
   recipes."* That is what happened — building the 8 Sep week added ~20 keys and took
   `ingredients` to 139. ⚠️ **Still: do not bulk-add the rest speculatively.** A key
   sourced with no recipe to spend it on has no pack, no price and no pantry row.
1f. ~~**The week marked `live` is last week.**~~ ✅ **CLOSED 7 Sep** — `2026-09-08` is
   live and current; `2026-08-30` is `closed`. ⚠️ **The trap stands: check a week's
   `starts_on` against today before reading it as the shopping list.** On 7 Sep I read
   the closed week as current and told Karl his list was missing things it did not need.
   *"This week's list isn't done yet, you're looking at last week."*
2. **Split-portion recipes.** Two recipes state Karl/Maria splits rather than
   per-portion figures. `kcal`/`portions` are NULL rather than guessed.
3. **Pantry numeric balance vs free-text `amount`.** `amount` is free text *on purpose*.
   Proposal: add `qty`/`qty_unit`/`qty_basis` alongside, prose wins on disagreement.
4. **Deleting the Notion databases.** Needs Karl's positive confirmation **and** the
   page verified reading D1. Neither has happened.
5. **6 recipes have no cost per portion** anywhere in the source.

---

## 9. Where things are

| | |
|---|---|
| repo | `~/projects/kitchen` |
| docs | `~/projects/kitchen/docs/` |
| skills | `~/projects/skills/clousto*/SKILL.md` |
| D1 | `clousto` `e1268405-4322-460d-9635-6e004c4061dd` |
| ⛔ do not touch | `finance` `e03fad1b-…`, `ironlog` `ff1a03ea-…` |
| Notion (stale, read-only) | Recipe Library `collection://1a16fca2-aea5-4e4a-bf44-448aae74bc3b` · Pantry `collection://2514813c-5eb0-4add-b81e-a1a3bee71268` |
| sibling apps | Clint (`~/projects/finance`), Iron Log (`~/projects/ironlog`) |
