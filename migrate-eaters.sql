-- Eater profiles: the week grid and the ask-once floor. Applied 23 Sep 2026.
--
-- Karl, 10 Sep 2026, on the week-shape spec §6:
--   * a screen in the app; one row per eater, 7 days from params.week_start_day,
--     a tick per slot per person per day; the grid is PER WEEK (23 Sep).
--   * slots are fixed and hierarchical: MORNING (a block — "breakfast" by
--     default, Karl's expands into Clophie's slots) · LUNCH · DINNER.
--   * ⛔ a ticked dinner is a PORTION, not a meal: one dish per night if anyone
--     has it ticked. Morning and lunch ticks are separate things to buy.
--   * ⛔ ASK-ONCE: nobody can be ticked into any slot until the restrictions
--     question has been answered, even if the answer is "none".
--
-- The floor lives in triggers, not in the app, so every write path — the app,
-- Cowork's direct SQL, a future scheduled build — hits the same wall.

-- ---------------------------------------------------------------------------
-- profiles: three columns
-- ---------------------------------------------------------------------------

-- NULL = nobody has asked this person. A date = the question was answered,
-- and restrictions_stated holds the answer verbatim ("none" included). This is
-- what separates "a guest nobody asked" from "a guest with no restrictions".
ALTER TABLE profiles ADD COLUMN restrictions_asked_on TEXT;

-- JSON array: what the MORNING block expands into for this person.
-- NULL = the default, ["breakfast"]. Karl's is filled from Clophie by the menu
-- build's mismatch check — never guessed.
ALTER TABLE profiles ADD COLUMN morning_slots TEXT;

-- The Cloudflare Access login, so a phone opens on its owner's row and a tick
-- records who made it. Guests have none. SQLite cannot ADD a UNIQUE column, so
-- uniqueness is an index.
ALTER TABLE profiles ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email COLLATE NOCASE);

-- ---------------------------------------------------------------------------
-- eater_ticks: the week grid, one row per week × person × day × slot
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS eater_ticks (
  week_start TEXT    NOT NULL,     -- YYYY-MM-DD, the first day of the grid
  profile_id TEXT    NOT NULL REFERENCES profiles(id),
  day        INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),   -- 0 = week_start
  slot       TEXT    NOT NULL CHECK (slot IN ('morning','lunch','dinner')),
  ticked     INTEGER NOT NULL CHECK (ticked IN (0,1)),
  ts         INTEGER NOT NULL,     -- ms epoch; last write wins, as in picks
  device     TEXT,
  by_email   TEXT,                 -- the Access login that made the tick
  PRIMARY KEY (week_start, profile_id, day, slot)
);

-- ⛔ ASK-ONCE. A tick needs an answered restrictions question. A profile that
-- does not exist has no answer, so it is refused by the same test.
CREATE TRIGGER IF NOT EXISTS eater_ticks_ask_once_ins
BEFORE INSERT ON eater_ticks
WHEN NEW.ticked = 1
 AND (SELECT restrictions_asked_on FROM profiles WHERE id = NEW.profile_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ask-once: restrictions not answered for this eater');
END;

CREATE TRIGGER IF NOT EXISTS eater_ticks_ask_once_upd
BEFORE UPDATE ON eater_ticks
WHEN NEW.ticked = 1
 AND (SELECT restrictions_asked_on FROM profiles WHERE id = NEW.profile_id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'ask-once: restrictions not answered for this eater');
END;

-- ...and the answer cannot be un-asked while that person is ticked anywhere.
CREATE TRIGGER IF NOT EXISTS profiles_ask_once_keep
BEFORE UPDATE OF restrictions_asked_on ON profiles
WHEN NEW.restrictions_asked_on IS NULL
 AND EXISTS (SELECT 1 FROM eater_ticks WHERE profile_id = OLD.id AND ticked = 1)
BEGIN
  SELECT RAISE(ABORT, 'ask-once: cannot clear restrictions_asked_on while ticked');
END;

-- ---------------------------------------------------------------------------
-- week_demand: what the menu build plans from
-- ---------------------------------------------------------------------------
-- ⛔ Dinner: ONE row per night anyone has it ticked; `portions` = ticks.
--    Two ticked eaters are two portions of one dish, never two dinners.
-- Morning and lunch: one row per person — each is a separate thing to buy.
-- `slots` is what the row expands into: a person's morning block, or itself.
CREATE VIEW IF NOT EXISTS week_demand AS
SELECT t.week_start, t.day, 'dinner' AS slot, NULL AS profile_id,
       COUNT(*) AS portions, '["dinner"]' AS slots,
       group_concat(t.profile_id) AS eaters
FROM eater_ticks t JOIN profiles p ON p.id = t.profile_id
WHERE t.slot = 'dinner' AND t.ticked = 1 AND p.restrictions_asked_on IS NOT NULL
GROUP BY t.week_start, t.day
UNION ALL
SELECT t.week_start, t.day, t.slot, t.profile_id, 1 AS portions,
       CASE t.slot WHEN 'morning' THEN COALESCE(p.morning_slots, '["breakfast"]')
                   ELSE '["lunch"]' END AS slots,
       t.profile_id AS eaters
FROM eater_ticks t JOIN profiles p ON p.id = t.profile_id
WHERE t.slot IN ('morning','lunch') AND t.ticked = 1 AND p.restrictions_asked_on IS NOT NULL;

-- ---------------------------------------------------------------------------
-- The two existing eaters
-- ---------------------------------------------------------------------------
-- Maria: her source note dates her statement 30 Aug 2026.
-- Karl: his source note carries no date; the migration date stands in until he
-- gives a real one.
UPDATE profiles SET email = 'mefspores@gmail.com', restrictions_asked_on = '2026-08-30',
       updated_at = CURRENT_TIMESTAMP WHERE id = 'maria';
UPDATE profiles SET email = 'csainzmartinez@gmail.com', restrictions_asked_on = '2026-09-21',
       updated_at = CURRENT_TIMESTAMP WHERE id = 'karl';
