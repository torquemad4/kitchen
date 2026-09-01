// POST /api/cook
//
// What actually happened at the hob. The Recipe Library keeps "Estimated min —
// what Clousto predicted" precisely so it can be compared against reality; this
// is the other half of that comparison. Per-step actuals go in too, because a
// dish that overruns usually overruns in one identifiable step rather than
// uniformly, and knowing which one is the useful part.
export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const recipeId = String(b?.recipeId || "").trim();
  const startedAt = b?.startedAt;
  if (!recipeId) return json({ error: "recipeId is required" }, 400);
  if (!startedAt) return json({ error: "startedAt is required" }, 400);

  const endedAt = b?.endedAt || new Date().toISOString();
  const elapsed = Number.isFinite(Date.parse(startedAt))
    ? Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60000)
    : null;

  const steps = Array.isArray(b?.stepTimes) ? b.stepTimes.slice(0, 60) : [];

  try {
    await env.DB.prepare(
      `INSERT INTO cook_log (id, recipe_id, week_id, started_at, ended_at, step_times, elapsed_min, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      String(b?.id || `${recipeId}-${Date.parse(startedAt)}`),
      recipeId, b?.weekId || null, String(startedAt), String(endedAt),
      JSON.stringify(steps), elapsed, String(b?.notes || "")
    ).run();

    // Report the comparison back, since that is the whole point of recording it.
    const r = await env.DB.prepare(`SELECT est_min FROM recipes WHERE id = ?`).bind(recipeId).first();
    const est = r?.est_min ?? null;
    return json({
      ok: true, elapsedMin: elapsed, estimatedMin: est,
      deltaMin: (est != null && elapsed != null) ? elapsed - est : null,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
