// GET /api/stock  -> what the pantry currently says about each week-document key
//
// ⭐ STAGE B. Until now the cart was built against `weeks.doc.held` — a snapshot of the
//    pantry taken by hand when the week was published, and frozen there. This endpoint
//    is the live answer to the same question, joined recipes → ingredients → pantry.
//
// ⛔ IT DOES NOT RETURN QUANTITIES, AND THAT IS NOT AN OVERSIGHT. `pantry.amount` is
//    free text on purpose — "About half of a 400 g block" is honest in a way `0.5` is
//    not — so there is no number here to subtract a requirement from. The week's own
//    `held` map stays the arithmetic basis; this supplies TRUTH and DOUBT on top of it:
//    what is actually gone, and how old the claim is.
//
// The keys are the ones the WEEK speaks (pack keys, plus any superseded alias), so the
// page can look up straight from the cart it already builds.

const WEAK = ["recalled", "inferred"];

// How long a claim stands before it should be doubted. Coarse on purpose — the point is
// to surface age, not to pretend a threshold is precise.
const STALE = { chilled: 7, bakery: 7, "pasta & grains": 21, "dry goods": 21,
                "pulses & tinned": 30, "oils & condiments": 30,
                "sauces & sachets": 30, spices: 45 };

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT i.key, i.name, i.pack_key, i.aliases,
              p.id AS pantry_id, p.item, p.category, p.level, p.amount,
              p.how_checked, p.last_checked, p.floor, p.notes
         FROM ingredients i
         LEFT JOIN pantry p ON p.id = i.pantry_id`
    ).all();

    const today = new Date();
    const byKey = {};
    for (const r of results || []) {
      // No pantry row means NOBODY IS TRACKING IT — which is not the same as
      // "we have none" and not the same as "we have some". Say so plainly.
      const tracked = !!r.pantry_id;
      const days = r.last_checked
        ? Math.round((today - new Date(r.last_checked + "T00:00:00Z")) / 86400000)
        : null;
      const limit = STALE[r.category] ?? 30;
      const entry = {
        key: r.key, name: r.name, tracked,
        item: r.item || null, level: r.level || null, amount: r.amount || null,
        howChecked: r.how_checked || null, lastChecked: r.last_checked || null,
        weakEvidence: WEAK.includes(r.how_checked),
        daysSinceChecked: days,
        stale: days != null && days > limit,
        floor: r.floor || null,
        // ⛔ The 3 September rule, encoded. A week document can claim an ingredient is
        //    held while the pantry knows it is gone — that is exactly how the beef &
        //    stout stew reached the pan without its tomato paste. When the pantry says
        //    `out`, the cart must buy it whatever the frozen snapshot says.
        overrideHeld: r.level === "out",
      };
      byKey[r.key] = entry;
      // Reachable under every name a published week might use for it.
      if (r.pack_key && r.pack_key !== r.key) byKey[r.pack_key] = entry;
      if (r.aliases) {
        try { for (const a of JSON.parse(r.aliases)) byKey[a] = entry; } catch {}
      }
    }

    const seen = new Set(Object.values(byKey));
    const rows = [...seen];
    return json({
      byKey,
      counts: {
        keys: rows.length,
        tracked: rows.filter(r => r.tracked).length,
        out: rows.filter(r => r.level === "out").length,
        low: rows.filter(r => r.level === "low").length,
        unmeasured: rows.filter(r => r.level === "unmeasured").length,
        weakEvidence: rows.filter(r => r.weakEvidence).length,
        stale: rows.filter(r => r.stale).length,
      },
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
