// GET  /api/state?week=<id>   -> shared tick and pick state for that week
// POST /api/state             -> a batch of tick/pick events from one phone
//
// Two phones, one aisle, and a shop with patchy signal. Events carry the
// client's clock and the server keeps the newest per key, so a phone that was
// offline for ten minutes can drain its queue afterwards without clobbering
// what the other phone did in the meantime — only its own stale entries lose.
//
// Batched on purpose: a drain after a dead spot is one request, not thirty.

const MAX_EVENTS = 500;

export async function onRequestGet({ request, env }) {
  const weekId = new URL(request.url).searchParams.get("week");
  if (!weekId) return json({ error: "week is required" }, 400);
  try {
    const [picks, cart] = await Promise.all([
      env.DB.prepare(`SELECT slot_key, option_idx, ts, device FROM picks WHERE week_id = ?`)
        .bind(weekId).all(),
      env.DB.prepare(`SELECT item_key, state, ts, device FROM cart_state WHERE week_id = ?`)
        .bind(weekId).all(),
    ]);
    const p = {}, c = {};
    for (const r of picks.results || []) p[r.slot_key] = { idx: r.option_idx, ts: r.ts, device: r.device };
    for (const r of cart.results || []) c[r.item_key] = { state: r.state, ts: r.ts, device: r.device };
    return json({ weekId, picks: p, cart: c, serverTime: Date.now() });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const weekId = body?.weekId;
  const device = String(body?.device || "unknown").slice(0, 60);
  const events = Array.isArray(body?.events) ? body.events : [];
  if (!weekId) return json({ error: "weekId is required" }, 400);
  if (!events.length) return json({ ok: true, applied: 0 });
  if (events.length > MAX_EVENTS) return json({ error: "too many events in one batch" }, 413);

  // Last write wins, enforced in SQL rather than by read-then-write, so two
  // phones draining at the same moment cannot interleave into a lost update.
  const tick = env.DB.prepare(
    `INSERT INTO cart_state (week_id, item_key, state, ts, device) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(week_id, item_key) DO UPDATE SET
       state = excluded.state, ts = excluded.ts, device = excluded.device
     WHERE excluded.ts > cart_state.ts`
  );
  const pick = env.DB.prepare(
    `INSERT INTO picks (week_id, slot_key, option_idx, ts, device) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(week_id, slot_key) DO UPDATE SET
       option_idx = excluded.option_idx, ts = excluded.ts, device = excluded.device
     WHERE excluded.ts > picks.ts`
  );

  const batch = [];
  let skipped = 0;
  for (const e of events) {
    const ts = Number(e?.ts);
    if (!e?.key || !Number.isFinite(ts)) { skipped++; continue; }
    if (e.kind === "tick") {
      const state = e.value === "ticked" || e.value === "none" ? e.value : "untouched";
      batch.push(tick.bind(weekId, String(e.key), state, ts, device));
    } else if (e.kind === "pick") {
      const idx = Number(e.value);
      if (!Number.isInteger(idx) || idx < 0) { skipped++; continue; }
      batch.push(pick.bind(weekId, String(e.key), idx, ts, device));
    } else {
      skipped++;
    }
  }
  if (!batch.length) return json({ ok: true, applied: 0, skipped });

  try {
    await env.DB.batch(batch);
    return json({ ok: true, applied: batch.length, skipped });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
