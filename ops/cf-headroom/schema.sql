-- One row per metric per daily run. A failed run writes a single '_error' row
-- so the check-in can tell "no data" from "all quiet".
CREATE TABLE IF NOT EXISTS cf_headroom (
  checked_at    TEXT NOT NULL,   -- UTC ISO timestamp of the run
  metric        TEXT NOT NULL,   -- e.g. worker_requests, d1_rows_written, r2_class_a
  used          REAL,
  included      REAL,            -- Workers Paid inclusion for the period
  unit          TEXT,
  pct           REAL,            -- used / included, as a percentage
  projected_pct REAL,            -- straight-line projection to period end
  period_start  TEXT,
  period_end    TEXT,
  error         TEXT,
  PRIMARY KEY (checked_at, metric)
);
