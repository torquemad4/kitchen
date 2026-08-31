// GET /api/week          -> the live week
// GET /api/week?id=...   -> a specific week, for looking back
//
// The week used to be a literal inside the HTML, which meant publishing a new
// week meant republishing the document — the exact operation that failed on
// 30 Aug 2026 and cost the bookmark on both phones. Now the document is the
// engine and this is the data.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    const row = id
      ? await env.DB.prepare(
          `SELECT id, label, store, status, doc, published_at FROM weeks WHERE id = ?`
        ).bind(id).first()
      : await env.DB.prepare(
          `SELECT id, label, store, status, doc, published_at FROM weeks
           WHERE status = 'live' ORDER BY starts_on DESC LIMIT 1`
        ).first();

    if (!row) {
      return json({ error: id ? `no week with id ${id}` : "no live week has been published" }, 404);
    }

    let doc;
    try {
      doc = JSON.parse(row.doc);
    } catch {
      // A half-written week renders as a plausible wrong shopping list, which is
      // worse than an error in an aisle. Refuse instead.
      return json({ error: "the stored week is not valid JSON" }, 500);
    }

    return json({
      id: row.id,
      label: row.label,
      store: row.store,
      status: row.status,
      publishedAt: row.published_at,
      content: doc,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status,
    headers: {
      "content-type": "application/json",
      // The week changes under the page and the aisle list must never be stale.
      "cache-control": "no-store",
    },
  });
}

// PUT /api/week
//
// Publishes a built week. This replaces the whole republish-the-document dance:
// a Claude session builds the week and puts it here, and both phones have it on
// their next load without anyone touching a bookmark.
//
// ⛔ Refuses a partial week. A shopping list missing a slot renders as a
//    plausible, wrong list, and the person holding it is standing in an aisle.
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const id    = String(body?.id || "").trim();
  const label = String(body?.label || "").trim();
  const doc   = body?.content;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    return json({ error: "id must be the week's start date, YYYY-MM-DD" }, 400);
  }
  if (!doc || typeof doc !== "object") return json({ error: "content is required" }, 400);

  const problems = [];
  for (const k of ["packs", "slots", "choices"]) {
    if (!doc[k]) problems.push(`content.${k} is missing`);
  }
  if (Array.isArray(doc.slots) && !doc.slots.length)   problems.push("content.slots is empty");
  if (Array.isArray(doc.choices) && !doc.choices.length) problems.push("content.choices is empty");
  for (const set of [].concat(doc.choices || [], doc.slots || [])) {
    if (!set?.key) { problems.push("a slot has no key"); continue; }
    if (!Array.isArray(set.opts) || set.opts.length < 2) {
      problems.push(`slot "${set.key}" needs at least two options — three is the rule`);
    }
  }
  if (problems.length) return json({ error: "the week was not published", problems }, 422);

  const live = body?.status === "draft" ? "draft" : "live";
  try {
    const stmts = [];
    if (live === "live") {
      // Exactly one live week. Two is how two phones read different lists.
      stmts.push(env.DB.prepare(`UPDATE weeks SET status='closed' WHERE status='live' AND id <> ?`).bind(id));
    }
    stmts.push(env.DB.prepare(
      `INSERT INTO weeks (id, label, store, starts_on, ends_on, status, doc)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label, store = excluded.store, ends_on = excluded.ends_on,
         doc = excluded.doc, status = excluded.status, updated_at = CURRENT_TIMESTAMP`
    ).bind(id, label || doc.week || id, doc.store || null, id,
           body?.endsOn || null, live, JSON.stringify(doc)));
    await env.DB.batch(stmts);

    const back = await env.DB.prepare(`SELECT status, length(doc) AS bytes FROM weeks WHERE id = ?`)
      .bind(id).first();
    if (!back) return json({ error: "wrote the week but could not read it back" }, 500);

    return json({
      ok: true, id, status: back.status, bytes: back.bytes,
      slots: (doc.slots || []).length, choices: (doc.choices || []).length,
      packs: Object.keys(doc.packs || {}).length,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}
