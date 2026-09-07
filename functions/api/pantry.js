// GET /api/pantry            -> what is in the house
// GET /api/pantry?level=low  -> filtered to one level
//
// ⭐ `how_checked` is not decoration and must survive to the page. Photographed
//    and counted are stronger evidence than recalled and inferred, and the
//    3 Sep stale-paste failure happened precisely because a count taken on
//    18 Aug was still being cited as fact on 3 Sep. The grading is what lets
//    someone see that a number is old before they cook from it.
//
// ⚠️ `level` keeps `unmeasured` as a real state. It is not "probably fine" and
//    it is not "out" — it is nobody has looked. Flattening it into a boolean
//    would start lying, in both directions.

const FIELDS = `id, item, category, level, amount, how_checked, last_checked,
                floor, dated, best_before, route, notes, notion_url`;

// Weakest first: the page surfaces these, because they are the rows most
// likely to be wrong when someone leans on them.
const WEAK = ["recalled", "inferred"];

export async function onRequestGet({ request, env }) {
  const level = new URL(request.url).searchParams.get("level");

  try {
    const { results } = level
      ? await env.DB.prepare(`SELECT ${FIELDS} FROM pantry WHERE level = ? ORDER BY category, item`)
          .bind(level).all()
      : await env.DB.prepare(`SELECT ${FIELDS} FROM pantry ORDER BY category, item`).all();

    const rows = (results || []).map(r => ({
      id: r.id, item: r.item, category: r.category, level: r.level,
      amount: r.amount,
      howChecked: r.how_checked, lastChecked: r.last_checked,
      weakEvidence: WEAK.includes(r.how_checked),
      floor: r.floor, dated: !!r.dated, bestBefore: r.best_before,
      route: r.route, notes: r.notes, notionUrl: r.notion_url,
    }));

    return json({
      count: rows.length,
      // Surfaced rather than computed on the page, so the two agree.
      weakEvidence: rows.filter(r => r.weakEvidence).length,
      unmeasured: rows.filter(r => r.level === "unmeasured").length,
      pantry: rows,
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
