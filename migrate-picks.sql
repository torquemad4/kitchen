-- The choices locked in on the artifact before the move. Migrated so the
-- site opens on the dinners actually chosen, not the week's defaults.
INSERT INTO picks (week_id, slot_key, option_idx, ts, device) VALUES
  ('2026-08-30', 'mon', 0, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'tue', 2, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'wed', 2, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'thu', 2, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'k1', 1, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'k2', 0, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'k3', 2, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'k4', 1, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'kb', 0, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'mb', 3, 1788096121136, 'migrated-from-artifact'),
  ('2026-08-30', 'ml', 0, 1788096121136, 'migrated-from-artifact')
ON CONFLICT(week_id, slot_key) DO UPDATE SET
  option_idx = excluded.option_idx, ts = excluded.ts, device = excluded.device
  WHERE excluded.ts > picks.ts;
