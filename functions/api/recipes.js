// GET /api/recipes            -> the whole library
// GET /api/recipes?id=...     -> one recipe
// GET /api/recipes?name=...   -> one recipe, by the name the week document carries
//
// ⭐ D1 is the system of record for the recipe library as of 7 Sep 2026. Notion
// is no longer authoritative for it. This endpoint is the only way the page
// gets a recipe: the week document still carries a denormalised copy of
// whatever was published, and that copy is a snapshot, not the library.
//
// ⛔ `method` is returned VERBATIM and whole — every step, every ingredient,
//    every bold marker. The emphasis is load-bearing: it marks the things that
//    ruin the dish. Week 2 was cooked from a compressed card, lost the peppers
//    from the stir-fry and the lemon from the salmon, and got rated "fine".
//    Do not add truncation, summarising or "tidying" here.
//
// The whole library is ~36 rows and is served in one response on purpose. Aldi
// has poor signal, the page caches this to localStorage, and one fetch that
// works beats six that fail in an aisle.

// ⭐ `cook` itself is NOT in this list — it is 6-8 KB per recipe and the page
//    fetches the one it needs from /api/recipe. But whether a card EXISTS has
//    to travel with the library, because the page decides from it whether to
//    offer Cook mode at all. Shipping the flag costs a byte; shipping the
//    cards would triple the payload the aisle has to download.
const FIELDS = `id, name, slot, status, rating, ingredients, method, source,
                est_min, hands_on_min, elapsed_min, times_cooked, last_cooked,
                uses_pantry, vegan_variant, cooking_notes, eating_notes,
                notion_url, headline, kcal, protein_g, portions, cost_per_portion,
                (cook IS NOT NULL AND cook <> '') AS has_cook`;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name");

  try {
    if (id || name) {
      const row = id
        ? await env.DB.prepare(`SELECT ${FIELDS} FROM recipes WHERE id = ?`).bind(id).first()
        : await env.DB.prepare(`SELECT ${FIELDS} FROM recipes WHERE name = ?`).bind(name).first();
      if (!row) return json({ error: "no such recipe", id: id || name }, 404);
      return json({ recipe: shape(row) });
    }

    const { results } = await env.DB.prepare(
      `SELECT ${FIELDS} FROM recipes ORDER BY slot, name`
    ).all();

    return json({
      count: (results || []).length,
      recipes: (results || []).map(shape),
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

// Booleans come back from SQLite as 0/1; everything else is passed through
// untouched, because the text is the point.
function shape(r) {
  return {
    id: r.id, name: r.name, slot: r.slot, status: r.status, rating: r.rating,
    ingredients: r.ingredients,   // the compressed one-liner the cart builder reads
    method: r.method,             // the full page body, verbatim
    source: r.source,
    estMin: r.est_min, handsOnMin: r.hands_on_min, elapsedMin: r.elapsed_min,
    // ⚠️ times_cooked is KNOWN-BROKEN upstream and migrated as-is: 5 recipes are
    //    marked cooked and the count is 0 or null across the board. There is an
    //    open Notion task for it. Do not infer a count from cook_log here — a
    //    number invented to look tidy is worse than a visibly broken one.
    timesCooked: r.times_cooked, lastCooked: r.last_cooked,
    usesPantry: !!r.uses_pantry, veganVariant: !!r.vegan_variant,
    // ⛔ The page renders the Cook mode button ONLY when this is true. A button
    //    that opens "no cook card for this one yet" is a control that lies, and
    //    on 9 Sep 2026 that was 35 of 38 recipes — including every dish in the
    //    live week. Things are on the page or they are not.
    hasCook: !!r.has_cook,
    cookingNotes: r.cooking_notes, eatingNotes: r.eating_notes,
    notionUrl: r.notion_url,
    // The headline is hand-written prose and varies. It is kept raw alongside
    // the parsed numbers so nothing is lost where a parse was wrong or absent.
    headline: r.headline,
    kcal: r.kcal, proteinG: r.protein_g,
    portions: r.portions, costPerPortion: r.cost_per_portion,
  };
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
