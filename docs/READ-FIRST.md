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

The app is **one HTML file** (`public/index.html`) plus six Pages Functions. No build
step, no framework, no CI. **Pushing to `main` deploys nothing.**

The loop has five stages: **A** menu creation (Cowork) → **B** picks & shopping list
(app) → **E** receipt (Cowork) → **C** pre-cook checks (app) → **D** cook confirm and
pantry decrement (app). **Only B is meaningfully built.** See `architecture.md` §2.

### The two hard constraints behind most design decisions
1. **Offline.** Aldi has poor signal; the aisle is the hostile environment.
2. **Two users at once.** Karl and Maria, two phones. Clousto exists *because*
   concurrent edits were being silently dropped.

---

## 2. The document map

| file | owns | update it when… |
|---|---|---|
| `docs/READ-FIRST.md` | this — orientation and the maintenance contract | the doc set or the invariants change |
| `docs/architecture.md` | the loop, stage ownership, **the data model**, invariants, known-broken | schema changes, a stage is built, an invariant is added |
| `docs/user-guide.md` | what Karl and Maria see and do | user-visible behaviour changes |
| `docs/code.md` | repo layout, endpoints, `index.html` internals, deploy, testing | code changes |
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
SELECT (SELECT COUNT(*) FROM recipes)                        AS recipes,     -- 36
       (SELECT COUNT(*) FROM pantry)                         AS pantry,      -- 56
       (SELECT COUNT(*) FROM weeks)                          AS weeks,       --  1
       (SELECT length(doc) FROM weeks WHERE status='live')   AS live_bytes,  -- 55312
       (SELECT COUNT(*) FROM picks)                          AS picks,       -- 11
       (SELECT COUNT(*) FROM cart_state)                     AS cart_state;  --  1
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
| **Rebuilding a card from a subset** | `libraryCard()` was written to rebuild the recipe card from the library and re-add week fields one at a time. That is a denylist — it silently drops whatever nobody thought of. Augment, don't rebuild. |
| **Deploying to a preview** | `wrangler pages deploy` can land on a preview branch. Always confirm `Environment = Production`. |
| **`--commit-dirty=true`** | The 7 Sep deploy matches no commit. Commit before or immediately after deploying. |
| **Assuming the handover is right** | The 7 Sep handover said `times_cooked` was "0 or null across the board". It was 2,2,2,1,1. **Check the data.** |

---

## 8. Open decisions — do not invent an answer

These are Karl's to make. If a change depends on one, ask.

1. **The canonical `ingredient_key`.** Proposed: seed from the existing pack keys.
   Requires backfilling 56 pantry rows; six bundle rows cannot take one.
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
