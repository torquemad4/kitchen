# cf-headroom

Once a day at 06:30 UTC, this Worker measures the account's Cloudflare usage for the current billing period. It compares each figure with what the Workers Paid plan includes. It writes one row per metric to the `ops` D1 database (`a2998dfb-407f-4bd4-b543-f45d1e595a23`), in the `cf_headroom` table. The daily check-in reads the newest rows.

It covers Workers and Pages Functions requests, Workers CPU time, D1 rows read and written, D1 storage, R2 storage, and R2 Class A and B operations. It has no public URL; the cron trigger is the only way it runs.

## One-time setup (dashboard)

1. **Token.** Go to *My Profile → API Tokens → Create Token → Custom*. Give it one permission only: *Account · Account Analytics · Read*, scoped to this account. Then run:
   `npx wrangler secret put CF_ANALYTICS_TOKEN` (from this folder), and paste the token.
   Until this is done, each run writes a single `_error` row.
2. **Overage alert.** Go to *Manage Account → Billing → Billable Usage → Set Budget Alert*, and set $1. Cloudflare already created a default alert at $10. Budget alerts count only usage-based spend, not the $5 plan fee, so $1 fires on the first real overage.

## Reading it

```sql
SELECT metric, pct, projected_pct, unit, used, included, period_start, error
FROM cf_headroom
WHERE checked_at = (SELECT MAX(checked_at) FROM cf_headroom);
```

`pct` is how much of the period's inclusion has been used so far. `projected_pct` is a straight-line projection to the end of the period. Storage is a level rather than a running total, so its projection is the same as its current value.

## Deploy

`npx wrangler@4 deploy` from this folder. Schema: `schema.sql`.

`BILLING_DAY` in `wrangler.toml` is 4 because Workers Paid started on 4 Sep 2026. Cloudflare aligns billing to the account's first purchase date. If *Billing → Billable Usage* shows the period starting on a different day, change `BILLING_DAY` to match.
