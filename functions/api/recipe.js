// GET /api/recipe?name=<recipe name>   -> the cook card for that recipe
//
// Keyed on the recipe NAME because that is what the week document carries in
// each option. Whichever of the three options is picked, cook mode looks the
// name up here; a recipe with no card yet says so plainly rather than
// rendering an empty one.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const id = url.searchParams.get("id");
  if (!name && !id) return json({ error: "name or id is required" }, 400);

  try {
    const row = id
      ? await env.DB.prepare(
          `SELECT id, name, slot, status, est_min, hands_on_min, cook, notion_url FROM recipes WHERE id = ?`
        ).bind(id).first()
      : await env.DB.prepare(
          `SELECT id, name, slot, status, est_min, hands_on_min, cook, notion_url FROM recipes WHERE name = ?`
        ).bind(name).first();

    if (!row) return json({ error: "no cook card for this recipe yet", name: name || id }, 404);
    if (!row.cook) return json({ error: "this recipe has no cook card yet", name: row.name }, 404);

    let cook;
    try { cook = JSON.parse(row.cook); }
    catch { return json({ error: "the stored cook card is not valid JSON" }, 500); }

    return json({
      id: row.id, name: row.name, slot: row.slot, status: row.status,
      estMin: row.est_min, handsOnMin: row.hands_on_min,
      notionUrl: row.notion_url, cook,
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
