#!/usr/bin/env node
// Turn a week document into the SQL that publishes it.
//
//   node seed-week.mjs <week.json> <week-id> "<label>" > seed.sql
//   npx wrangler d1 execute clousto --remote --file=./seed.sql -y
//
// Stage 3 replaces this with PUT /api/week, at which point publishing a week
// is one authenticated call from a Claude session and this file goes away.
import { readFileSync } from "node:fs";

const [file, id, label] = process.argv.slice(2);
if (!file || !id) {
  console.error('usage: node seed-week.mjs <week.json> <week-id> "<label>"');
  process.exit(2);
}

const doc = JSON.parse(readFileSync(file, "utf8"));
for (const k of ["slots", "choices", "packs"]) {
  if (!doc[k]) { console.error(`  x the document has no "${k}"`); process.exit(1); }
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

// Only one week may be live, so demote the incumbent in the same statement run.
process.stdout.write(`UPDATE weeks SET status = 'closed' WHERE status = 'live';\n`);
process.stdout.write(
  `INSERT INTO weeks (id, label, store, starts_on, ends_on, status, doc)\n` +
  `VALUES (${q(id)}, ${q(label || doc.week || id)}, ${q(doc.store || "")}, ` +
  `${q(id)}, NULL, 'live', ${q(JSON.stringify(doc))})\n` +
  `ON CONFLICT(id) DO UPDATE SET\n` +
  `  label = excluded.label, store = excluded.store, doc = excluded.doc,\n` +
  `  status = 'live', updated_at = CURRENT_TIMESTAMP;\n`
);
console.error(`  ok ${Object.keys(doc.packs).length} packs, ${doc.slots.length} slots, ${doc.choices.length} dinner choices`);
