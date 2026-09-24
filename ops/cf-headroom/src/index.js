// cf-headroom — once a day, measure Cloudflare usage for the current billing
// period against what the Workers Paid plan includes, and write one row per
// metric into the `ops` D1 database. The daily check-in reads the latest rows.
//
// Needs a secret CF_ANALYTICS_TOKEN (Account Analytics: Read, nothing else)
// and vars ACCOUNT_ID and BILLING_DAY (day of month the billing cycle starts).

// Workers Paid plan inclusions, per billing period.
const INCLUDED = {
  worker_requests: { included: 10_000_000, unit: "requests" },
  worker_cpu_ms: { included: 30_000_000, unit: "CPU ms" },
  d1_rows_read: { included: 25_000_000_000, unit: "rows" },
  d1_rows_written: { included: 50_000_000, unit: "rows" },
  d1_storage_bytes: { included: 5_000_000_000, unit: "bytes" },
  r2_storage_bytes: { included: 10_000_000_000, unit: "bytes" },
  r2_class_a: { included: 1_000_000, unit: "ops" },
  r2_class_b: { included: 10_000_000, unit: "ops" },
};

// R2 operation classes. Anything unlisted counts as Class A (the dearer one),
// so a new operation type can only over-report, never hide.
const R2_CLASS_B = new Set([
  "HeadBucket", "HeadObject", "GetObject", "UsageSummary",
  "GetBucketEncryption", "GetBucketLocation", "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);
const R2_FREE = new Set(["DeleteObject", "DeleteObjects", "DeleteBucket", "AbortMultipartUpload"]);

const QUERY = `query($a: String!, $s: Date!, $e: Date!, $st: Time!, $et: Time!, $recent: Date!, $recentT: Time!) {
  viewer { accounts(filter: {accountTag: $a}) {
    w: workersInvocationsAdaptive(limit: 10000, filter: {date_geq: $s, date_leq: $e}) { sum { requests cpuTimeUs } }
    pf: pagesFunctionsInvocationsAdaptiveGroups(limit: 10000, filter: {date_geq: $s, date_leq: $e}) { sum { requests } }
    d: d1AnalyticsAdaptiveGroups(limit: 10000, filter: {date_geq: $s, date_leq: $e}) { sum { rowsRead rowsWritten } }
    ds: d1StorageAdaptiveGroups(limit: 10000, filter: {date_geq: $recent}) { max { databaseSizeBytes } dimensions { databaseId date } }
    ro: r2OperationsAdaptiveGroups(limit: 10000, filter: {datetime_geq: $st, datetime_leq: $et}) { sum { requests } dimensions { actionType } }
    rs: r2StorageAdaptiveGroups(limit: 10000, filter: {datetime_geq: $recentT}) { max { payloadSize metadataSize } dimensions { bucketName datetime } }
  } }
}`;

const iso = (d) => d.toISOString().slice(0, 10);
const sum = (rows, pick) => (rows || []).reduce((n, r) => n + (pick(r) || 0), 0);

// Latest reading per key, summed across keys (per database, per bucket).
function latestPerKey(rows, key, when, value) {
  const latest = new Map();
  for (const r of rows || []) {
    const k = key(r), t = when(r);
    if (!latest.has(k) || latest.get(k).t < t) latest.set(k, { t, v: value(r) });
  }
  return [...latest.values()].reduce((n, x) => n + x.v, 0);
}

export function billingPeriod(now, billingDay) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let start = new Date(Date.UTC(y, m, billingDay));
  if (start > now) start = new Date(Date.UTC(y, m - 1, billingDay));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, billingDay));
  return { start, end };
}

export async function measure(env, now = new Date()) {
  const { start, end } = billingPeriod(now, Number(env.BILLING_DAY || 1));
  const recent = new Date(now.getTime() - 2 * 86400_000);
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        a: env.ACCOUNT_ID, s: iso(start), e: iso(now),
        st: start.toISOString(), et: now.toISOString(),
        recent: iso(recent), recentT: recent.toISOString(),
      },
    }),
  });
  const body = await res.json();
  if (!res.ok || body.errors?.length) throw new Error(`GraphQL ${res.status}: ${JSON.stringify(body.errors)}`);
  const a = body.data.viewer.accounts[0];

  let classA = 0, classB = 0;
  for (const r of a.ro || []) {
    const t = r.dimensions.actionType;
    if (R2_FREE.has(t)) continue;
    if (R2_CLASS_B.has(t)) classB += r.sum.requests; else classA += r.sum.requests;
  }

  const used = {
    worker_requests: sum(a.w, (r) => r.sum.requests) + sum(a.pf, (r) => r.sum.requests),
    worker_cpu_ms: Math.round(sum(a.w, (r) => r.sum.cpuTimeUs) / 1000),
    d1_rows_read: sum(a.d, (r) => r.sum.rowsRead),
    d1_rows_written: sum(a.d, (r) => r.sum.rowsWritten),
    d1_storage_bytes: latestPerKey(a.ds, (r) => r.dimensions.databaseId, (r) => r.dimensions.date, (r) => r.max.databaseSizeBytes),
    r2_storage_bytes: latestPerKey(a.rs, (r) => r.dimensions.bucketName, (r) => r.dimensions.datetime, (r) => r.max.payloadSize + r.max.metadataSize),
    r2_class_a: classA,
    r2_class_b: classB,
  };

  // Straight-line projection to the end of the period. Storage is a level, not
  // a running total, so it projects as itself.
  const elapsed = Math.max((now - start) / 86400_000, 1);
  const length = (end - start) / 86400_000;
  return Object.entries(INCLUDED).map(([metric, { included, unit }]) => {
    const u = used[metric];
    const projected = metric.endsWith("_storage_bytes") ? u : (u / elapsed) * length;
    return {
      metric, used: u, included, unit,
      pct: +(100 * u / included).toFixed(3),
      projected_pct: +(100 * projected / included).toFixed(3),
      period_start: iso(start), period_end: iso(end),
    };
  });
}

async function record(env, now = new Date()) {
  const checkedAt = now.toISOString();
  let rows;
  try {
    rows = await measure(env, now);
  } catch (err) {
    await env.DB.prepare(
      "INSERT INTO cf_headroom (checked_at, metric, error) VALUES (?, '_error', ?)"
    ).bind(checkedAt, String(err).slice(0, 500)).run();
    throw err;
  }
  await env.DB.batch(rows.map((r) => env.DB.prepare(
    `INSERT INTO cf_headroom (checked_at, metric, used, included, unit, pct, projected_pct, period_start, period_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(checkedAt, r.metric, r.used, r.included, r.unit, r.pct, r.projected_pct, r.period_start, r.period_end)));
  return rows;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(record(env));
  },
  // No public route; this exists so `wrangler dev --test-scheduled` and a
  // manual curl against a workers.dev preview can trigger a run.
  async fetch(_req, env) {
    return Response.json(await measure(env));
  },
};
