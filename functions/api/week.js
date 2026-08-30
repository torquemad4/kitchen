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
