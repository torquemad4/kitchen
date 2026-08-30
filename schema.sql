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
  ts         TEXT NOT NULL,            -- client clock; last write wins
  device     TEXT,                     -- kept so a disagreement is diagnosable
  PRIMARY KEY (week_id, slot_key)
);

-- Aisle state per pack. Stage 2.
CREATE TABLE IF NOT EXISTS cart_state (
  week_id  TEXT NOT NULL,
  pack_key TEXT NOT NULL,
  state    TEXT NOT NULL,              -- ticked | none | untouched
  ts       TEXT NOT NULL,
  device   TEXT,
  PRIMARY KEY (week_id, pack_key)
);
