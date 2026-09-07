-- Clousto Kitchen — D1 schema
--
-- Stage 1 stores the week as a DOCUMENT rather than normalised rows, and that
-- is a deliberate distinction rather than a shortcut: a week is a snapshot that
-- Claude publishes whole and never edits field-by-field, whereas the pantry and
-- the recipe library (stage 3) are long-lived entities queried across weeks.
-- Different lifecycles, different shapes.
--
-- picks and cart_state are keyed on the slot and pack keys that already exist
-- inside the document, so stage 2's write-back needs no migration — only code.

CREATE TABLE IF NOT EXISTS weeks (
  id           TEXT PRIMARY KEY,       -- e.g. 2026-08-30
  label        TEXT NOT NULL,          -- "Sun 30 Aug – Mon 7 Sep 2026"
  store        TEXT,
  starts_on    TEXT,
  ends_on      TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',   -- draft | live | closed
  doc          TEXT NOT NULL,          -- the whole published week, as JSON
  published_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Exactly one week may be live at a time. A second live week is how two phones
-- end up looking at different lists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_weeks_one_live
  ON weeks(status) WHERE status = 'live';

-- Which of the three options was chosen for each slot. Stage 2.
CREATE TABLE IF NOT EXISTS picks (
  week_id    TEXT NOT NULL,
  slot_key   TEXT NOT NULL,            -- mon|tue|wed|thu|k1..k4|kb|mb|ml
  option_idx INTEGER NOT NULL,
  ts         INTEGER NOT NULL,         -- client clock, ms; last write wins
  device     TEXT,                     -- kept so a disagreement is diagnosable
  PRIMARY KEY (week_id, slot_key)
);

-- Aisle state per shopping line. Stage 2.
--
-- item_key is the line's DISPLAY NAME, because that is what the cart renders
-- and ticks against (data-item="<name>"). It is not the pack key, and calling
-- the column pack_key would have been a lie about its contents. Ticks are
-- scoped to a week, so a name changing between weeks costs nothing.
--
-- 'none' is reserved for the out-of-stock tap the Clousto hub page describes.
-- ⚠️ That tap does NOT exist in the 30 Aug build — the column anticipates it so
-- that adding it later is UI work with no migration.
CREATE TABLE IF NOT EXISTS cart_state (
  week_id  TEXT NOT NULL,
  item_key TEXT NOT NULL,
  state    TEXT NOT NULL,              -- ticked | none | untouched
  ts       INTEGER NOT NULL,           -- client clock, ms; last write wins
  device   TEXT,                       -- kept so a disagreement is diagnosable
  PRIMARY KEY (week_id, item_key)
);

-- ===========================================================================
-- Stage 3. Long-lived entities, queried across weeks — unlike a week, which is
-- a snapshot published whole. These are the tables the Notion databases become.
-- ===========================================================================

-- ⭐ The parameters a machine ENFORCES, each pointing at the Notion ruling that
-- set it. The reasoning stays in Notion; the enforced value lives here, because
-- a scheduled headless build may have no Notion auth at all. One writer per
-- fact still holds: the ruling is written once, in prose there and as a value
-- here, and the builder only ever reads here.
CREATE TABLE IF NOT EXISTS params (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'text',   -- text | number | json | bool
  note       TEXT,                            -- what it means, in one line
  ruling_url TEXT,                            -- the Notion page that settled it
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- One row per eater. restrictions_stated is NEVER paraphrased — the phrasing is
-- the evidence. unclassified = 1 means enforce block-harm until a class is
-- confirmed, which is the safe default and must not be silently cleared.
CREATE TABLE IF NOT EXISTS profiles (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  household           TEXT,
  status              TEXT,        -- new | onboarding | shadow mode | active | paused
  step                TEXT,
  daily_kcal          REAL,
  protein_g           REAL,
  carbs_g             REAL,
  fat_g               REAL,
  macro_approach      TEXT,
  restrictions_stated TEXT,
  restrictions_source TEXT,        -- WHO said it, and when. Attribution is load-bearing.
  classes_present     TEXT,        -- JSON array
  unclassified        INTEGER NOT NULL DEFAULT 1,
  cross_contamination INTEGER NOT NULL DEFAULT 0,
  loves               TEXT,
  dislikes            TEXT,
  meal_patterns       TEXT,
  cooks_per_week      REAL,
  hands_on_ceiling_min REAL,
  policy_accepted     INTEGER NOT NULL DEFAULT 0,
  policy_version      TEXT,
  policy_accepted_on  TEXT,
  health_data_consent INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Everything ever generated. `method` is VERBATIM and full: compressing a
-- recipe is a defect, not tidying — week 2 lost the peppers from the stir-fry
-- and the lemon from the salmon exactly that way.
CREATE TABLE IF NOT EXISTS recipes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slot          TEXT,      -- fish | chicken | beef | pork | veg | breakfast | standby
  status        TEXT,      -- cooked | generated | planned | retired
  rating        TEXT,      -- great | good | fine | poor | unrated
  ingredients   TEXT,
  method        TEXT,      -- the full card, verbatim
  source        TEXT,
  est_min       REAL,
  hands_on_min  REAL,
  elapsed_min   REAL,
  times_cooked  INTEGER DEFAULT 0,
  last_cooked   TEXT,
  uses_pantry   INTEGER NOT NULL DEFAULT 0,
  vegan_variant INTEGER NOT NULL DEFAULT 0,
  cooking_notes TEXT,
  eating_notes  TEXT,
  notion_url    TEXT,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recipes_slot ON recipes(slot, status);

-- What is in the house. `level` keeps `unmeasured` as a real state and
-- `how_checked` grades the evidence: photographed and counted are stronger than
-- recalled and inferred, and flattening that into a number would start lying.
CREATE TABLE IF NOT EXISTS pantry (
  id           TEXT PRIMARY KEY,
  item         TEXT NOT NULL,
  category     TEXT,
  level        TEXT,       -- plenty | ok | low | out | unmeasured
  amount       TEXT,       -- free text on purpose: units differ by item
  how_checked  TEXT,       -- photographed | counted | at-the-pan | recalled | inferred
  last_checked TEXT,
  floor        TEXT,
  dated        INTEGER NOT NULL DEFAULT 0,
  best_before  TEXT,
  route        TEXT,       -- which dish consumes this, for orphaned stock
  notes        TEXT,
  notion_url   TEXT,
  -- ⛔ 1 = kept for its history, NOT current stock. The five food bundles split
  --    on 7 Sep 2026 into individual rows, plus "Salt & pepper". Listing a parent
  --    beside its children shows the same spices twice.
  superseded   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pantry_level ON pantry(level, category);

-- Predicted against actual, shop by shop.
CREATE TABLE IF NOT EXISTS cart_history (
  week_id         TEXT PRIMARY KEY,
  store           TEXT,
  shopped_on      TEXT,
  predicted_total REAL,
  actual_total    REAL,
  notes           TEXT,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- Cook mode. The structured card a person actually cooks from.
-- ===========================================================================

-- `cook` is the ordered card: ingredients, equipment, prep, then steps with
-- their own timers. Kept apart from recipes.method, which stays the verbatim
-- library text — the card is a RESTRUCTURING of it and must never become the
-- only copy. Compressing a recipe is a defect: week 2 was cooked from a
-- compressed card, lost the peppers from the stir-fry, and got rated "fine".
ALTER TABLE recipes ADD COLUMN cook TEXT;

-- What actually happened at the hob, so estimates can be calibrated against
-- reality rather than against themselves. The Recipe Library carries
-- "Estimated min — what Clousto predicted" for exactly this comparison.
CREATE TABLE IF NOT EXISTS cook_log (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  week_id     TEXT,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  step_times  TEXT,          -- JSON [{step, seconds}] — per-step actuals
  elapsed_min REAL,
  notes       TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cook_log_recipe ON cook_log(recipe_id, started_at DESC);

-- ===========================================================================
-- The canonical ingredient vocabulary. Reviewed and signed off 7 Sep 2026.
-- ===========================================================================

-- ⭐ THE JOIN. The key that connects a recipe ingredient to a pantry row to a
-- shop product. Stages B–E all depend on it; before this table existed there
-- was nothing tying `500 g pork shoulder` in a recipe to the pantry row that
-- holds it or the pack that buys it.
--
-- ⚠️ `aliases` exists so PUBLISHED WEEKS KEEP RESOLVING. weeks.doc keys its
--    ingredient maps on pack keys, and two of those (`pb`, `bread_wm`) were
--    superseded by better canonical names during review. Rewriting a published
--    week to match would make weeks/picks/cart_state collateral damage, which
--    is exactly what the invariants forbid — so the superseded key is recorded
--    here and readers resolve through it instead.
CREATE TABLE IF NOT EXISTS ingredients (
  key        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT,
  pack_key   TEXT,   -- the key weeks.doc uses, where a buyable pack exists
  pantry_id  TEXT,   -- the pantry row, where one exists
  aliases    TEXT,   -- JSON array of superseded keys still in published weeks
  in_bundle  TEXT,   -- the prose bundle row it must still be freed from
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ingredients_pack   ON ingredients(pack_key);
CREATE INDEX IF NOT EXISTS idx_ingredients_pantry ON ingredients(pantry_id);

-- ⭐ What a recipe actually consumes. The relation that made stages B–E possible.
-- `origin` records how the row was arrived at, and the two are not equal evidence:
--   'week'  — lifted from weeks.doc dinUse/sunUse: hand-authored, quantified, trusted.
--   'prose' — parsed from the recipe's compressed ingredient one-liner. Good enough
--             to plan on, but a NULL qty means the prose carried no number, never zero.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id      TEXT NOT NULL,
  ingredient_key TEXT NOT NULL,
  qty            REAL,          -- NULL = not stated in the source, NOT zero
  unit           TEXT,
  source         TEXT,          -- 'buy' | 'held', the BUY/HELD tag on the card
  origin         TEXT,          -- 'week' | 'prose'
  note           TEXT,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipe_id, ingredient_key)
);
