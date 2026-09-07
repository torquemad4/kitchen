# Clousto — System Architecture

**Status of this document:** current as of **7 September 2026**.
**Scope:** the whole Clousto loop — menu creation, shopping, cooking, and the pantry
that ties them together.

> ⚠️ **Read the status markers.** Large parts of this architecture are *designed here
> and not yet built*. Every section is marked ✅ BUILT, 🟡 PARTIAL or 🔴 NOT BUILT.
> A document that describes intended behaviour as though it were live is the exact
> failure this system keeps suffering from — a confident label on a number nobody
> checked. Do not remove these markers; update them.

---

## 1. What Clousto is

Clousto plans the household's food: what gets cooked, what gets bought, and what is
already in the house. It has been **load-bearing since 21 August 2026** — it carries
the food line on the no-remortgage path. A broken week has a real cost.

It is one of three apps on the same personal platform:

| app | domain | D1 database | owns |
|---|---|---|---|
| **Clousto** | `kitchen.torquemada.uk` | `clousto` `e1268405-4322-460d-9635-6e004c4061dd` | food, pantry, recipes |
| **Clint** | `finance.torquemada.uk` | `finance` `e03fad1b-4f29-455c-a771-750a2520ba39` | household finance |
| **Iron Log** | — | `ironlog` `ff1a03ea-1f08-4c1b-8878-59f13e69fdb7` | training |

⛔ **The Clophie → Clousto arrow is one-way (ruling R41).** Clophie owns the macro
targets. Clousto reads them and never writes back.

### Three non-negotiable operating facts

1. **It must work offline.** Aldi has poor signal. The aisle is the hostile
   environment this app is designed around, and anything that only works on a good
   connection is broken.
2. **Two users, concurrently.** Karl and Maria both tick the shopping list on
   separate phones at the same time. Clousto exists *because* concurrent edits were
   being silently dropped when the week lived in an artifact. Never regress that.
3. ⛔ **The page carries no maybes.** Karl, 7 Sep 2026: *"The front end is only for
   shopping, picking, and cooking, nothing more. Don't tell me what went wrong before,
   don't tell me what's uncertain."* Everything this document records about evidence,
   staleness and past failures is real, and none of it belongs on the screen — it is
   here so that a *week* is built correctly, and a correctly built week needs no
   caveats. See §2.1 and invariant 10.

---

## 2. The loop

```
        ┌───────────────────────────────────────────────────────────────┐
        │                                                               │
        ▼                                                               │
  ┌───────────┐   A. MENU CREATION (Cowork chat, weekly)                │
  │  Cowork   │   reads pantry ─► writes 3 new recipes                  │
  │           │                 ─► 3 options per day, pantry-first      │
  │           │                 ─► ingredient availability per store    │
  └─────┬─────┘                                                         │
        │ writes D1 at the end of the conversation                      │
        ▼                                                               │
  ┌───────────────────────────────────────────────┐                     │
  │                 D1  (clousto)                 │                     │
  │  recipes · pantry · shopping · weeks · picks  │                     │
  └───────┬───────────────────────────────────────┘                     │
          │                                                             │
          ▼                                                             │
  ┌───────────┐   B. PICKS LOCK IN (app)                                │
  │    App    │   chosen recipes ─diff─► pantry ─► shopping list        │
  │  (Pages)  │                                                         │
  └─────┬─────┘                                                         │
        │ shop                                                          │
        ▼                                                               │
  ┌───────────┐   E. RECEIPT (Cowork chat)                              │
  │  Cowork   │   photo ─► parsed lines ─► pantry ++                    │
  └─────┬─────┘                            └─► cart_history.actual      │
        │                                                               │
        ▼                                                               │
  ┌───────────┐   C. COOK MODE START (app)                              │
  │    App    │   ≤3 coarse staleness checks ─► pantry re-anchored      │
  │           │                                                         │
  │           │   D. COOK MODE END (app)                                │
  │           │   confirm cooked + comments ─► cook_log                 │
  │           │                              ─► pantry −−               │
  └───────────┴───────────────────────────────────────────────────────►─┘
```

### Stage ownership

| stage | runs in | writes | status |
|---|---|---|---|
| **A** Menu creation | Cowork conversation | `recipes`, `pantry`, `ingredients`, `weeks` | ✅ **RAN 7 Sep 2026** — built the week of 8 Sep to the §5.5 contract, wrote 2 new recipes and ~20 new ingredient keys. `shopping` still does not exist. |
| **B** Picks → shopping list | App (browser) | `picks` | ✅ **BUILT 7 Sep 2026** — the cart is computed from each option's `use` map against `held`, so a changed pick moves the trolley. See §2.1. |
| **E** Receipt → pantry | Cowork conversation | `pantry`, `cart_history` | 🔴 NOT BUILT — **the most consequential gap left**, see §3 |
| **C** Pre-cook checks | App (browser) | `pantry` | 🔴 NOT BUILT |
| **D** Cook confirm → decrement | App (browser) | `cook_log`, `pantry`, `recipes.times_cooked` | 🟡 PARTIAL — cook_log written, no confirm, no decrement |

⚠️ **Karl's standing rule (4 Sep 2026): engine/code changes to a Cloudflare-hosted app
go through Claude Code, not Cowork. Cowork is the right place for D1 *data*.** That
boundary is why stages A and E are conversations and B/C/D are code.

### 2.1 Stage B as built ✅ BUILT

The cart is computed, not read. `ingredientNeed()` sums each picked option's `use` map
— multiplied by `days` for a standing slot — adds `fixed` and `floor`, subtracts what is
held, and rounds each shortfall up to its pack size. **So changing a pick changes the
trolley**, which is the point of choosing.

`GET /api/stock` joins `ingredients` → `pantry` and returns it keyed by every name a
published week might use (pack key, canonical key, alias). `heldFor()` reconciles it
against the week's own `held` map.

> ⛔ **KARL'S RULE, 7 Sep 2026 — THE FRONT END CARRIES NO MAYBES.**
> *"The front end is only for shopping, picking, and cooking, nothing more. Don't tell me
> what went wrong before, don't tell me what's uncertain. Tell me what I need to buy,
> what I'm eating each day, and how to make it. Full. Stop."*
>
> And: *"We can't have lines without quantities. Things are in the list or they are not,
> we know the quantity or we do not, we put it in the cart or we do not."*
>
> Two attempts were rejected before this landed — first a panel of advisory warnings,
> then a half-line stating a requirement ("needs 115 g") rather than a purchase. **Every
> decision is a line or no line. Nothing on the page is prose about a decision.**

**Held is decided by whichever source is fresher, and only `out` overrides a number:**

| the week vs the pantry | outcome |
|---|---|
| week `built` is later than the row's `last_checked` | the week's number stands |
| the row is as fresh or fresher, and says **`out`** | held = 0 → **it goes on the list** |
| the row is as fresh or fresher, and says `low` / `unmeasured` | the week's number **still stands** |
| no pantry row at all | the week's number stands |

⭐ **Why `low` does not override.** `low` is a bucket; the week's `held` is a number, and
300 g of oats *is* low — they do not contradict each other. Zeroing the number because a
coarser reading agrees with it put oats, peanut butter and soy sauce back on the list for
£1.94. `out` is different: it says *none*, and none beats any number. That is the
3 September failure — a paste counted on 18 August, gone by the pan — and it is tested.

⚠️ **A tie goes to the pantry.** A row checked the same day the week was built is at least
as current, and in practice means Karl has just said what is in the house.

**Every line has a size and a price.** An ingredient with no `packs` entry gets no line,
because a line has to say what to put in the trolley. That condition is refused at
publish instead — see §5.5 — rather than improvised around in the aisle.

---

## 3. The pantry is the centre, and it is about to change character

Everything in the loop reads or writes `pantry`. Understanding what it *is* matters
more than any other single thing in this system.

### What it is today ✅ BUILT

An **evidence-graded observation log**. Each row records what is in the house *and how
that is known*:

- `level` — `plenty | ok | low | out | unmeasured`. **`unmeasured` is a real state**:
  it means nobody has looked. It is not "probably fine" and it is not "out".
- `how_checked` — `photographed | counted | at-the-pan | recalled | inferred`.
  Photographed and counted are strong. Recalled and inferred are weak.
- `amount` — **free text on purpose**. Units differ by item. "About half of a 400 g
  block" is honest in a way `0.5` is not.
- `last_checked` — when.

89 rows: **82 live**, of which **63 are things we actually have** — a row that says
`out` is a record, not stock. The other 7 carry `superseded = 1`: the five food bundles
split on 7 Sep, `Salt & pepper`, and `Never reorder`, whose own note said never to
surface it. ⛔ **Every stock query filters `superseded = 0`**, or the same spices are
counted twice — once itemised, once as a paragraph.

⚠️ **Nothing in this table has been updated by a shop since 20 August.** That is stage E
missing, not neglect, and it is why the 8 Sep week was built from Karl saying out loud
what was in the cupboards. Rows are lower bounds of unknown age.

### The failure this design already suffered

> **3 September 2026 — the stale-record failure, caught at the pan.** The beef & stout
> stew card listed tomato paste and roasted garlic paste as HELD, on a count taken
> 18 August. Both were gone.
>
> ⭐ **The count was correct when made.** Nothing decremented it, because consumption
> outside a planned recipe is invisible. *A counted number with no decrement mechanism
> decays into a guess while keeping its confident label.*

### What it becomes 🔴 NOT BUILT

With receipts adding (stage E) and cooks subtracting (stage D), pantry becomes a
**running balance**. That fixes the decay above — and introduces its exact mirror:

> ⛔ **A DECREMENT IS NOT A CHECK.** If confirming a cook stamps `last_checked = today`,
> stage C will never ask about that item again, and the balance drifts optimistically
> forever — because unplanned consumption (snacking, spills, an unplanned meal) is
> still invisible. The number would look freshly-checked *precisely because nobody
> checked it.*

**The control:** two separate timestamps, and stage C targets the widest gap.

| column | meaning | written by |
|---|---|---|
| `last_checked` | last **physical observation** by a human | stage C, stage A, manual |
| `last_moved` | last **arithmetic** change | stages D and E |

A balance drifts; checks re-anchor it. That is the whole design, and it is why
"at most 3 checks per cook" is a budget worth spending well rather than a limit.

---

## 4. The join that makes the loop possible ✅ BUILT 7 Sep 2026

`ingredients` (139 rows) and `recipe_ingredients` (297 rows) connect *a recipe
ingredient* to *a pantry row* to *a buyable pack*. Before they existed, nothing tied
`500 g pork shoulder` in a recipe to the row that holds it or the pack that buys it, and
stages B–E were all blocked on that.

⭐ **The week document now carries structured `use` maps too** (§5.5), so the cart is
computed from the menu rather than read from a frozen list. Both halves of the September
migration are done: the human-readable one moved out of Notion, and the machine-readable
one out of the week blob.

⚠️ Still missing: **`shopping`**, the per-store availability and price table (§5.2). Until
it exists, store choice and receipt-line matching have nowhere to live.

### The key, and how it was chosen

A canonical **`ingredient_key`**, seeded from the pack keys already in use in
`weeks.doc` (they are terse, stable, and already understood by the cart builder).

```
ingredients(key)  ◄──── recipe_ingredients(recipe_id, ingredient_key, qty, unit, source)
      ▲
      ├────────────────  pantry(ingredient_key, qty, unit, …)
      └────────────────  shopping(ingredient_key, store, product, size, price, availability)
```

### ⭐ The vocabulary must be AUTHORED, not derived — measured 7 Sep 2026

An extraction pass over the library (36 recipes at the time; 38 now) settled two
things that were assumptions:

**1. A union of pack keys and pantry ids does not work — they overlap.** Roughly eight
genuine duplicates exist where a buyable pack and a pantry row are the same ingredient
under different names: `cheddar`/`extra_mature_cheddar`, `egg`/`eggs`, `ham`/`cooked_ham`,
`noodles`/`egg_noodles`, `oats`/`porridge_oats`, `onion`/`onions`,
`sardine`/`sardines_in_tomato_sauce`, `sesame_oil`/`toasted_sesame_oil`. A naive union
produces two keys for one thing, which is the join failing in exactly the way it is
meant to prevent. **The canonical list has to be written deliberately, with the pack and
the pantry row both pointing at it.**

**2. ⛔ The bundle rows are not an edge case — they are where a large share of recipe
ingredients live.** Of 246 ingredient mentions parsed from recipes, 133 could not be
mapped. Approximately **half of those refer to things the house genuinely holds but
which are locked inside prose bundles**: chicken stock (5 mentions), smoked paprika (5),
harissa, cumin, cinnamon, chilli powder (3 each), saffron, baharat, coriander (2 each),
plus every vinegar, every paste and the cornflour.

> ⚠️ **This invalidates the original proposal below that bundles simply get
> `is_bundle = 1` and are never decremented.** Spices and stocks appear in nearly every
> recipe. If they stay as prose lists inside six rows, **stage D cannot decrement most
> of what a recipe actually uses**, and stage C cannot ask about any of it — which is
> most of the pantry's staleness risk, since the spice rows were last checked 18 August.
>
> **Splitting the food bundles into real rows is a prerequisite for stages C and D**, not
> a tidy-up. `One-shot flavour bases` (8 items), `Other spice jars` (~14), `Pastes` (~8),
> `Stocks & thickeners` (3) and `Vinegars & cooking wines` (~7) are the ones that matter
> — roughly 40 new rows. `⚠️ HOUSEHOLD`, `⚠️ TOILETRIES`, `📌 Cat supplies` and `Never
> reorder — stable orphans` are genuinely not recipe ingredients and can stay bundled.

**3. About 36 further ingredients are tracked nowhere at all** — garlic, parsley, butter,
milk, salt, bay, turmeric, nutmeg, tofu, chorizo, mushrooms, passata, parmesan, wine, and
most proteins the current week does not happen to buy (brisket, pork shoulder, pork loin,
chicken legs). The pack list only ever described *this week's shop*.

⚠️ Sizing: the canonical list is therefore roughly **130–150 entries**, not the 65 the
week document knows about. ✅ It landed at 119 and stage A has since taken it to **139**,
inside the estimate.

### ✅ Settled — reviewed and live, 7 Sep 2026

125 proposed entries went to Karl; **7 dropped, 1 split, 117 kept → 119 live rows** in
`ingredients`. The draft that was reviewed is
[`ingredient-vocabulary.md`](ingredient-vocabulary.md).

⭐ **139 rows today.** Karl's rule was that unkeyed ingredients get sourced by stage A
when a recipe needing them is picked, rather than bulk-added; building the 8 Sep week
did exactly that for about twenty of them, and took `aliases` from 2 keys to 22.
⛔ **Do not bulk-add the rest.** A key with no recipe to spend it on has no pack, no
price and no pantry row — a row that looks like coverage and is not.

**Three things the review surfaced that the draft had wrong:**

⛔ **`salt & pepper` splits to `salt` + `black_pepper`, never `pepper`.** The pack key
`pepper` already means *Mixed peppers, 3-pack* — the vegetable — and it is referenced in
six places in the live week. A split producing `pepper` would have made every recipe
calling for black pepper decrement the bell peppers instead. **This is the exact silent
conflation the join exists to prevent, and it was one word away from being shipped.**

⚠️ **Two dropped keys are still spoken by the published week**, so they became aliases
rather than deletions: `pb` → `peanut_butter` (used in `held`, `sunUse` and four `use`
slots) and `bread_wm` → `bread` (used in `packs` and three `use` slots). Rewriting
`weeks.doc` to match the better names would make the live week collateral damage, which
invariant 6 forbids — so `ingredients.aliases` records the superseded key and readers
resolve through it. **The other five drops are clean:** `eggs`, `onions`, `tinned_tuna`,
`ground_black_pepper` and `red_wine` are referenced nowhere in the week.

⚠️ **`red_wine` was dropped outright.** It was the flagged entry that meant two products —
a 10 g red-wine *paste* sachet in `Pastes`, and red wine *vinegar* in `Vinegars`. Neither
now has a key, and at least one recipe (the bolognese) calls for "the held red wine paste
sachet". Either that recipe loses its mapping or a key comes back; **open.**

---

## 5. Data model

### 5.1 Live tables ✅ BUILT

```sql
weeks(id, label, store, starts_on, ends_on, status, doc, published_at, updated_at)
  -- doc is the WHOLE published week as JSON (~55 KB). A snapshot, published whole.
  -- UNIQUE INDEX idx_weeks_one_live ON weeks(status) WHERE status='live'
  --   ⛔ Exactly one live week. Two is how two phones read different lists.

picks(week_id, slot_key, option_idx, ts, device)        -- PK (week_id, slot_key)
cart_state(week_id, item_key, state, ts, device)        -- PK (week_id, item_key)
  -- Both last-write-wins on a CLIENT clock. ts is the phone's, not the server's.
  -- item_key is the line's DISPLAY NAME, not a pack key. Scoped to a week.

recipes(id, name, slot, status, rating, ingredients, method, source,
        est_min, hands_on_min, elapsed_min, times_cooked, last_cooked,
        uses_pantry, vegan_variant, cooking_notes, eating_notes, notion_url,
        cook, headline, kcal, protein_g, portions, cost_per_portion, updated_at)
  -- UNIQUE INDEX idx_recipes_notion_url   ⭐ the upsert key, see §7
  -- 38 rows, 30 with a method. method is the Notion page body VERBATIM.
  -- Stage A adds to this: the lamb shoulder and the full English arrived 7 Sep.

pantry(id, item, category, level, amount, how_checked, last_checked, floor,
       dated, best_before, route, notes, notion_url, superseded, updated_at)
  -- UNIQUE INDEX idx_pantry_notion_url
  -- 89 rows: 82 live, of which 63 are shown on the page (an `out` row is not stock).
  -- superseded = 1 keeps a row for its history without it counting as stock — the
  -- five food bundles split on 7 Sep, "Salt & pepper", and "Never reorder", whose
  -- own note said "never surface".

cook_log(id, recipe_id, week_id, started_at, ended_at, step_times, elapsed_min,
         notes, created_at)
  -- 1 row. step_times is JSON [{step, seconds}] — per-step actuals.

ingredients(key, name, category, pack_key, pantry_id, aliases, in_bundle, updated_at)
  -- ⭐ THE JOIN, live since 7 Sep 2026. 139 rows: 119 reviewed and signed off by
  -- Karl, plus ~20 that stage A sourced when the 8 Sep week needed them.
  -- 22 carry an alias. in_bundle is empty: every ingredient has its own pantry row.
  -- ⚠️ `aliases` is what lets published weeks keep resolving — see §4.

recipe_ingredients(recipe_id, ingredient_key, qty, unit, source, origin, note)
  -- ⭐ 297 rows, live 7 Sep 2026. 0 orphan keys.
  -- 90 rows `origin='week'` are authoritative (hand-authored, quantified).
  -- 207 are `origin='prose'`; a NULL qty means the source stated no number.

params(key, value, kind, note, ruling_url, updated_at)          -- 0 rows
profiles(id, name, household, status, …, restrictions_stated, …)-- 0 rows
cart_history(week_id, store, shopped_on, predicted_total, actual_total, notes)
                                                                 -- 0 rows
```

### 5.2 Proposed additions 🔴 NOT BUILT

```sql
-- The canonical ingredient. Small, stable, rarely edited.
CREATE TABLE ingredients (
  key        TEXT PRIMARY KEY,   -- 'sweetpot', 'tom_tin' — from the pack keys
  name       TEXT NOT NULL,      -- 'Sweet potatoes'
  category   TEXT,               -- matches pantry.category
  unit       TEXT,               -- canonical unit: g | ml | ea
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ⭐ THE MISSING RELATION. What a recipe actually consumes.
CREATE TABLE recipe_ingredients (
  recipe_id      TEXT NOT NULL,
  ingredient_key TEXT NOT NULL,
  qty            REAL,           -- in the ingredient's canonical unit
  unit           TEXT,
  source         TEXT,           -- 'buy' | 'held'  (the BUY/HELD tag on the card)
  note           TEXT,           -- '1 sachet', 'to 250 ml' — the prose qualifier
  PRIMARY KEY (recipe_id, ingredient_key)
);

-- Where each ingredient can be got. One row per ingredient PER STORE.
CREATE TABLE shopping (
  ingredient_key TEXT NOT NULL,
  store          TEXT NOT NULL,  -- Aldi | Lidl | Tesco | Morrisons | M&S
  product        TEXT,           -- the store's own product name
  size           REAL,
  unit           TEXT,
  price          REAL,
  availability   TEXT NOT NULL,  -- stocked | not-stocked | intermittent | unknown
  checked_at     TEXT,
  note           TEXT,
  PRIMARY KEY (ingredient_key, store)
);
```

⭐ **`shopping` does three jobs, which is why it is one row per ingredient per store:**
1. availability and price, so the cart picks the first store in preference order;
2. the store preference order itself is applied against it;
3. **it is the receipt dictionary** — an Aldi receipt line is cryptic and abbreviated,
   and `shopping.product` is what maps it back to an `ingredient_key` in stage E.

Facts the system already knows belong here rather than in pantry notes: *Aldi does not
stock fish sauce in any category. Aldi capers were unavailable across stores at the
last check. Suet was searched for in-store and not found. Aldi sells neither Sichuan
peppercorns nor ya cai. Aldi cannot supply any of the cat food.*

### 5.3 Proposed pantry changes 🔴 NOT BUILT

⚠️ **Prerequisite:** the five *food* bundle rows must be split into real rows first —
see §4. Roughly 40 new pantry rows, and without them stages C and D cannot see the
spices, stocks, pastes or vinegars that most recipes depend on.

```sql
ALTER TABLE pantry ADD COLUMN ingredient_key TEXT;  -- NULL only for true bundles
ALTER TABLE pantry ADD COLUMN is_bundle   INTEGER NOT NULL DEFAULT 0;
  -- ⚠️ after the split this should apply only to HOUSEHOLD, TOILETRIES,
  --    Cat supplies and Never-reorder — never to a food row.
ALTER TABLE pantry ADD COLUMN qty         REAL;     -- the machine balance
ALTER TABLE pantry ADD COLUMN qty_unit    TEXT;
ALTER TABLE pantry ADD COLUMN qty_basis   TEXT;     -- 'observed' | 'derived'
ALTER TABLE pantry ADD COLUMN last_moved  TEXT;     -- last ARITHMETIC change
```

⚠️ **`amount` (free text) stays.** It is not replaced by `qty`. The prose is the honest
record of what a human saw; `qty` is the machine's running balance. When they disagree,
**the prose wins and the balance is wrong** — that disagreement is a signal, not noise.

### 5.4 Standing rules belong in `params` 🔴 NOT BUILT

`params` exists and is empty. It is the right home for every number a machine enforces,
each pointing at the Notion ruling that set it:

| key | example value | why |
|---|---|---|
| `store_order` | `["Aldi","Lidl","Tesco","Morrisons","M&S"]` | stage A/B preference |
| `pantry_stale_days` | `{"spices":45,"dry goods":21,"chilled":7}` | drives stage C |
| `cook_checks_max` | `3` | ≤3 checks per cook |
| `emergency_floor` | `{"tuna":2,"pasta":200,"cheddar":1}` | the standby meal |

> 🔒 **The emergency-meal floor** (Karl, 23 Aug): *"canned tuna + pasta + cheese is our
> emergency meal, so let's make sure there's always 2 cans, 200 g of pasta, and some
> cheese in the house."* In practice this is a **cheese rule** — tuna sits at 3× its
> floor and pasta at many multiples; cheese is the only one that ever reaches zero.

### 5.5 The week document — the contract between Cowork and the app

⭐ **This section is canonical.** `~/projects/skills/clousto-menu` describes how to
build a week; **this describes the shape it must arrive in.** The skills directory is
not version-controlled, so where the two disagree, this wins.

On 7 Sep 2026 a week was published in a shape the engine could not read. The site went
down showing *"This week could not be loaded"* with the previous week already closed,
and the week that eventually rendered contained no breakfasts. Both failures came from
the same place: nothing had ever written the schema down.

```jsonc
{
  "week": "Tue 8 – Sun 13 Sep 2026", "store": "Aldi, Reading", "built": "2026-09-07",

  "packs": {                     // the CATALOGUE of buyable products
    "oats": { "n": "Porridge oats, 1 kg", "size": 1000, "u": "g",
              "price": 0.85, "g": "Cupboard", "d": "why", "qty": 1 }
  },
  "held":  { "rice": 900 },      // in the house, in pack-key units
  "fixed": { "bread_seed": 2 },  // bought every week regardless
  "floor": { "tuna": 2 },        // 🔒 the emergency meal

  "choices": [{                  // one entry per DECISION, three options each
    "key": "tue", "day": "Tue 8", "slot": "…", "spec": "…",
    "opts": [{ "n": "Pasta con le sarde", "pick": true,
               "time": "…", "cost": "…", "clears": "…", "split": "…", "makes": ["…"],
               "k": 885, "p": 51, "c": 92, "f": 28, "mk": 590, "mp": 34,
               "use": { "sardine": 4, "fusilli": 200 } }]
  }],

  "slots": [{                    // ⛔ SAME SHAPE. A label is not a slot.
    "key": "k1", "label": "Pre-workout", "days": 6,
    "opts": [{ "n": "The pour", "pick": true, "k": 190, "p": 9.8,
               "use": { "milk_skim": 250, "banana": 1 } }]
  }],

  "schedule": [{                 // ⭐ WHICH SLOTS EACH DAY RUNS
    "day": "Tue 8", "w": "office day",
    "karl":  [{ "key": "k1", "tag": "S1" },
              { "yfood": true, "tag": "S3",        // a slot REPLACED, not run
                "n": "yfood, 12 scoops", "m": "1200 kcal · 74.9 g P" },
              { "key": "tue", "tag": "S5" }],      // a choice key = the shared meal
    "maria": [{ "key": "mb", "tag": "B" }, { "key": "tue", "tag": "D" }]
  }],

  "notes": ["…"],
  "cost":  { "aldi_tuesday": 113.31, "tesco_saturday": 40.23, "week_total": 153.54 }
}
```

**The three fields that carry the load:**

⭐ **`use`** — what ONE serving of that option consumes, keyed on pack keys, in the
pack's unit; × `days` for a slot. This is what lets a changed pick change the trolley.
Without it the app can render a list but never recompute one. An option consuming
nothing new writes `"use": {}` **explicitly** — a deliberate empty map and a forgotten
one must not look alike.

⭐ **`slots[].opts`** — the standing daily meals. The 30 Aug week carried seven slots
of three or four options each: pre-workout, breakfast, two midday, a bonus, and Maria's
breakfast and lunch, with day counts of 6/6/3/3/5/6/7. Those counts vary per slot and
are not the length of the week. **A slot with a label and no options means the week
silently contains no breakfast** — Karl, 7 Sep: *"we always had 3 options for breakfast
in the morning, as well as a pre-workout. That's not there any more."*

⭐ **`packs[k]` for every key in `held`** — enforced by `PUT /api/week` (§2.1). Held
stock runs out after publication; without a pack the shortfall cannot be priced.

⭐ **`schedule`** — which slots each day runs, in the order the day happens. The slots
carry a day COUNT ("k3: 2 days") but never *which* days, so without this the week can
only be shown as dinners plus a standing list, and the Week tab cannot say what Tuesday
looks like.

An entry is either `{key, tag}` — a slot or choice to render — or a **replacement**:
`{yfood: true, tag, n, m}`, for a slot that does not run because something else covers
it. Karl's office days are the case that exists: `k3` is replaced by yfood, 12 scoops.

⛔ **Do not schedule what is not scheduled.** The bonus top-up `kb` is provisioned five
times a week but Karl takes it *"just as and when, it's not predictable"* — so it appears
in no day. Inventing a day for it would put a fiction on the page.

**The self-check that proves a week is coherent:** sum `use` across the default picks
(× `days` for slots), add `fixed` and `floor`, subtract `held`, round each up to its
pack size. That must reproduce every `packs[].qty`. If it does not, the stated menu and
the stated list disagree and one of them is wrong.

⚠️ **`opts[].n` must match a `recipes.name` exactly** where the dish is a library
recipe — that is the join the Recipes tab resolves through. Assemblies and leftovers
("Full English", "Friday's ragù, the portion held back") legitimately match nothing.

⚠️ **Cowork writes to `weeks` directly, so `PUT /api/week` validation does not run.**
Anything relying on that endpoint to catch a malformed week will not catch it.


---

## 6. Runtime architecture ✅ BUILT

```
kitchen.torquemada.uk
   │
   ├── Cloudflare Access  ⛔ everything is behind it; there is no back door
   │
   └── Cloudflare Pages project  kitchen-torquemada
         ├── public/index.html      the whole app: one file, no build step
         └── functions/api/*.js     Pages Functions, binding env.DB → D1 clousto
```

- **No build integration and no CI. Pushing to `main` deploys nothing.** Deployment is
  `bash deploy.sh`, or the narrow `wrangler pages deploy` inside it.
- `deploy.sh`, `access.mjs` and `domain.mjs` are **identical across every app** on the
  platform. Everything app-specific is in `app.conf`. Never edit them per-app.

### Offline model ✅ BUILT

Ticks and picks go into a **localStorage queue first**, then drain to `/api/state`.
Events carry the client's clock; the server keeps the newest per key. A phone offline
for ten minutes drains afterwards without clobbering the other phone — only its own
stale entries lose. Batched: a drain after a dead spot is one request, not thirty.

The recipe library and pantry are **cached to localStorage** on load for the same
reason. A library that only works on a good connection is not a library.

---

## 7. Invariants — break these and the system lies quietly

1. ⛔ **Exactly one week is `live`.** Enforced by a partial unique index. Two live weeks
   is how two phones read different lists.
2. ⭐ **`notion_url` is the upsert key for `recipes` and `pantry`.** UNIQUE indexes make
   this enforceable rather than merely intended. Inserting blind forks the library
   under new id slugs, quietly.
3. ⛔ **The three original stub ids — `poulet-basquaise`, `stir-fry`, `beef-stout-stew`
   — must keep their ids.** `weeks.doc` and `picks` may reference them.
4. ⛔ **`recipes.method` is VERBATIM.** Every step, every ingredient, in full. The bold
   emphasis is load-bearing: it marks what ruins the dish. Compressing a recipe is a
   defect, not tidying — week 2 was cooked from a compressed card, lost the peppers
   from the stir-fry and the lemon from the salmon, and got rated "fine".
5. ⚠️ **`recipes.cook` is a RESTRUCTURING of `method`, never the only copy.**
6. ⛔ **Never delete, reorder or rewrite `weeks`, `picks` or `cart_state`** as part of
   library or pantry work.
7. ⛔ **One store, not two kept in agreement.** No sync job, cron or scheduled task
   between Notion and D1. A sync job quietly recreates the problem being fixed.
8. ⛔ **No second database and no `_v2` tables.** Alter the existing schema.
9. ⛔ **Nothing writes back to Clophie** (R41).
10. ⛔ **The page carries no maybes.** Karl, 7 Sep 2026: *"The front end is only for
    shopping, picking, and cooking, nothing more. Don't tell me what went wrong before,
    don't tell me what's uncertain."* A decision reaches the page as a line or as no
    line, never as prose about the decision. Every line has a size and a price; a
    condition that cannot be expressed that way is a defect in the week, refused at
    publish. **This one generalises past Clousto** — he does not want hedging UI
    anywhere.
11. ⛔ **`pantry.superseded = 0` in every stock query.** A superseded row is history, not
    stock; counting it lists the same spices twice, once itemised and once as prose.
12. ⛔ **`effectiveCart()` never drops an aisle group.** Known aisles keep walking order,
    unknown ones are appended. A cart that walks only the aisles it recognises silently
    loses the second shop — on the live week, the £40 lamb and the wines.

---

## 8. Known-broken and open

| item | state |
|---|---|
| **`times_cooked`** | ⚠️ Open Notion task says it is not maintained. The 5 cooked rows *do* carry counts (2,2,2,1,1) — the original handover's claim that they are "0 or null across the board" is **wrong**. Stage D is what would make it self-maintaining. |
| **6 recipes have no cost/portion** | Never written in the source headline. They sort last in any price-first query. |
| **2 recipes are split-portion** | *Sesame-peanut noodles (CHICKEN)* and *Weeknight beef ragù* state Karl/Maria splits, not per-portion figures. `kcal`/`portions` are NULL rather than guessed. Needs a representation decision. |
| **8 recipes have no method** | Their Notion pages are genuinely blank. Mostly retired. 30 of 38 now carry one. |
| **Notion databases** | Stale but must stay until Karl positively confirms deletion **and** the page is verified reading D1. |
| **No `shopping` table** | Per-store availability and price (§5.2). Store choice is expressed as a pack `g` group today, and receipt-line matching has nowhere to live. |
| **Stage E does not exist** | Every shop puts food in the house the pantry never hears about, so its rows drift and stock has to be restated by hand. This is why the 8 Sep week was built from Karl's spoken stock rather than the table. |

---

## 9. Where the documentation lives

| document | owns |
|---|---|
| `docs/architecture.md` | this file — the loop, the data model, the invariants |
| `docs/user-guide.md` | how Karl and Maria actually use it |
| `docs/code.md` | the codebase: endpoints, page internals, deploy |
| `docs/READ-FIRST.md` | ⭐ **for Claude.** Read before changing anything. |
| `~/projects/skills/clousto/SKILL.md` | operating guide for reading/writing the D1 |
| `~/projects/skills/clousto-menu/SKILL.md` | stage A, the weekly menu conversation |
| `~/projects/skills/clousto-receipt/SKILL.md` | stage E, receipt → pantry |
| `docs/ingredient-vocabulary.md` | the reviewed vocabulary draft, frozen for the record — the live list is the `ingredients` table |

⚠️ **`~/projects/skills` is not version-controlled**; the repo wins where they disagree.
The three skills are also exported as `.skill` zips for Cowork — **re-export after any
edit**, or Cowork keeps running the old text.
