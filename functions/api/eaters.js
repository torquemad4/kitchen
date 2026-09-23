// GET  /api/eaters?week=YYYY-MM-DD  -> the week grid: who eats, which slots are ticked
// POST /api/eaters                  -> a batch of tick events from one phone
// PUT  /api/eaters                  -> add an eater, or answer their restrictions question
//
// Karl, 10 Sep 2026: "Screen in the app is easiest, yes." 7 days from
// params.week_start_day × one row per eater × morning / lunch / dinner. A tick
// means Clousto plans that slot. The grid is per week (23 Sep 2026); a week
// nobody has touched yet opens pre-filled from the last week that was.
//
// ⛔ ASK-ONCE. Nobody can be ticked until their restrictions question is
// answered, even if the answer is "none". The floor is the triggers on
// eater_ticks (schema.sql), not this file — this file only reports a refusal
// back so the phone stops retrying it.
//
// ⛔ The page carries no maybes: the grid gets `asked` true/false per eater and
// never the restrictions text itself.

const SLOTS = ["morning", "lunch", "dinner"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_EVENTS = 500;
// Pre-filled rows carry ts = 1, so any real tap — on either phone — beats them.
const PREFILL_TS = 1;

export async function onRequestGet({ request, env }) {
  try {
    const startDay = await weekStartDay(env);
    const asked = new URL(request.url).searchParams.get("week");
    const current = weekStartOn(today(), startDay);
    // Opens on the week being planned: this one if it starts today, else the next.
    let week = current === today() ? current : addDays(current, 7);
    if (asked) {
      if (!isDate(asked)) return json({ error: "week must be YYYY-MM-DD" }, 400);
      if (new Date(asked + "T00:00:00Z").getUTCDay() !== startDay)
        return json({ error: "week must start on a " + DAYS[startDay] }, 400);
      week = asked;
    }

    // Pre-fill a week nobody has touched from the last week that was touched.
    // Only forward: opening an old empty week must not invent its history.
    let prefilledFrom = null;
    if (week >= current) {
      const has = await env.DB.prepare(`SELECT 1 FROM eater_ticks WHERE week_start = ? LIMIT 1`)
        .bind(week).first();
      if (!has) {
        const prev = await env.DB.prepare(
          `SELECT MAX(week_start) AS w FROM eater_ticks WHERE week_start < ?`).bind(week).first();
        if (prev?.w) {
          // The join keeps the copy inside the ask-once floor on its own terms;
          // the triggers would refuse anything else anyway.
          await env.DB.prepare(
            `INSERT INTO eater_ticks (week_start, profile_id, day, slot, ticked, ts, device)
             SELECT ?, t.profile_id, t.day, t.slot, t.ticked, ?, 'prefill:' || t.week_start
             FROM eater_ticks t JOIN profiles p ON p.id = t.profile_id
             WHERE t.week_start = ? AND (t.ticked = 0 OR p.restrictions_asked_on IS NOT NULL)
             ON CONFLICT DO NOTHING`
          ).bind(week, PREFILL_TS, prev.w).run();
          prefilledFrom = prev.w;
        }
      }
    }

    const email = accessEmail(request);
    const [profiles, ticks] = await Promise.all([
      env.DB.prepare(
        `SELECT id, name, household, email, restrictions_asked_on IS NOT NULL AS asked
         FROM profiles WHERE COALESCE(status, '') <> 'paused'`).all(),
      env.DB.prepare(
        `SELECT profile_id, day, slot, ticked, ts FROM eater_ticks WHERE week_start = ?`)
        .bind(week).all(),
    ]);

    const rows = (profiles.results || []).map(p => ({
      id: p.id, name: p.name, guest: p.household === "guest", asked: !!p.asked,
      me: !!(email && p.email && p.email.toLowerCase() === email),
    }));
    // The phone's owner first, then the household, then guests.
    rows.sort((a, b) => (b.me - a.me) || (a.guest - b.guest) || a.name.localeCompare(b.name));

    const t = {};
    for (const r of ticks.results || []) t[r.profile_id + "|" + r.day + "|" + r.slot] = { v: r.ticked, ts: r.ts };

    return json({
      week, current, startDay: DAYS[startDay], slots: SLOTS,
      profiles: rows, ticks: t, prefilledFrom, serverTime: Date.now(),
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const week = body?.week;
  const device = String(body?.device || "unknown").slice(0, 60);
  const events = Array.isArray(body?.events) ? body.events : [];
  if (!isDate(week)) return json({ error: "week is required" }, 400);
  if (!events.length) return json({ ok: true, applied: 0, refused: [] });
  if (events.length > MAX_EVENTS) return json({ error: "too many events in one batch" }, 413);

  const email = accessEmail(request);
  // Last write wins, in SQL, exactly as /api/state does it.
  const stmt = env.DB.prepare(
    `INSERT INTO eater_ticks (week_start, profile_id, day, slot, ticked, ts, device, by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_start, profile_id, day, slot) DO UPDATE SET
       ticked = excluded.ticked, ts = excluded.ts, device = excluded.device, by_email = excluded.by_email
     WHERE excluded.ts > eater_ticks.ts`
  );

  const good = [];
  let skipped = 0;
  for (const e of events) {
    const ts = Number(e?.ts), day = Number(e?.day), v = Number(e?.value);
    if (!e?.profile || !Number.isFinite(ts) || !Number.isInteger(day) || day < 0 || day > 6 ||
        !SLOTS.includes(e?.slot) || (v !== 0 && v !== 1)) { skipped++; continue; }
    good.push({ e, s: stmt.bind(week, String(e.profile), day, e.slot, v, ts, device, email) });
  }
  if (!good.length) return json({ ok: true, applied: 0, refused: [], skipped });

  try {
    await env.DB.batch(good.map(g => g.s));
    return json({ ok: true, applied: good.length, refused: [], skipped });
  } catch (err) {
    // A batch is one transaction, so a single refused tick sinks the lot.
    // Replay one at a time so the good ones land and the refused ones are named.
    if (!/ask-once/.test(String(err?.message || err))) return json({ error: String(err?.message || err) }, 500);
    const refused = [];
    let applied = 0;
    for (const g of good) {
      try { await g.s.run(); applied++; }
      catch (e2) {
        if (!/ask-once/.test(String(e2?.message || e2))) return json({ error: String(e2?.message || e2) }, 500);
        refused.push({ profile: g.e.profile, day: g.e.day, slot: g.e.slot, ts: g.e.ts });
      }
    }
    return json({ ok: true, applied, refused, skipped });
  }
}

// { name }                        -> add a guest (unasked; cannot be ticked yet)
// { id, restrictions, saidBy }    -> answer the restrictions question, once
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const email = accessEmail(request);

  try {
    if (body?.id) {
      const answer = String(body.restrictions ?? "").trim();
      if (!answer) return json({ error: "an answer is required — \"none\" counts" }, 400);
      const p = await env.DB.prepare(`SELECT name, restrictions_asked_on FROM profiles WHERE id = ?`)
        .bind(String(body.id)).first();
      if (!p) return json({ error: "no such eater" }, 404);
      // Asked ONCE. Changing an answer is a conversation with Karl, not a tap.
      if (p.restrictions_asked_on) return json({ error: "already answered" }, 409);
      const saidBy = String(body.saidBy || p.name).trim().slice(0, 80);
      const on = today();
      // restrictions_stated is the answer VERBATIM; the source says who said it.
      await env.DB.prepare(
        `UPDATE profiles SET restrictions_stated = ?, restrictions_source = ?,
           restrictions_asked_on = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND restrictions_asked_on IS NULL`
      ).bind(answer.slice(0, 2000),
             saidBy + ", stated; entered in the app by " + (email || "unknown") + " on " + on + ".",
             on, String(body.id)).run();
      return json({ ok: true });
    }

    const name = String(body?.name || "").trim().slice(0, 60);
    if (!name) return json({ error: "a name is required" }, 400);
    // A double tap must not make two of the same person.
    if (await env.DB.prepare(`SELECT 1 FROM profiles WHERE name = ? COLLATE NOCASE`).bind(name).first())
      return json({ error: name + " is already on the grid" }, 409);
    const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guest";
    let id = base, n = 1;
    while (await env.DB.prepare(`SELECT 1 FROM profiles WHERE id = ?`).bind(id).first()) id = base + "-" + (++n);
    await env.DB.prepare(
      `INSERT INTO profiles (id, name, household, status, notes)
       VALUES (?, ?, 'guest', 'active', ?)`
    ).bind(id, name, "Added in the app by " + (email || "unknown") + " on " + today() + ".").run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

// ---------------------------------------------------------------------------

async function weekStartDay(env) {
  const r = await env.DB.prepare(`SELECT value FROM params WHERE key = 'week_start_day'`).first();
  const i = DAYS.findIndex(d => d.toLowerCase() === String(r?.value || "Monday").trim().toLowerCase());
  return i < 0 ? 1 : i;
}

// Today in the household's time zone, as YYYY-MM-DD.
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

// The grid week that contains `date`.
function weekStartOn(date, startDay) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - startDay + 7) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isDate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// Cloudflare Access puts the signed-in email on every request it lets through.
function accessEmail(request) {
  const e = request.headers.get("cf-access-authenticated-user-email");
  return e ? e.trim().toLowerCase() : null;
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
