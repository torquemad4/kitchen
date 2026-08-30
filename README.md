# Clousto Kitchen

`kitchen.torquemada.uk`. Cloudflare Pages + Pages Functions + D1, behind
Cloudflare Access. The week's shopping list and every recipe card, on a URL
that does not move.

## Why this exists

The week used to be a literal inside an HTML artifact, so publishing a new week
meant republishing the document. On **30 August 2026 that failed**: the session
could not read the live version, a publish not built on the live version was
refused, and `force:true` was refused at the same layer. The week moved to a new
URL and broke the bookmark on both phones — the one thing the same-URL rule
exists to prevent.

Here the document is the **engine** and the week is **data**. Publishing a week
writes a row; the hostname never changes.

## Where things stand

**Stage 1 — done.** One durable URL, serving the live week read-only from D1.

- Ticks and picks are saved **on the phone only**. They do not sync to the other
  phone yet. The app says so rather than implying otherwise — a tick that
  silently fails to save is worse in an aisle than one that never claimed to.
- Publishing a week is `seed-week.mjs` plus a `wrangler d1 execute`.

**Stage 2 — next.** `POST /api/tick` and `/api/pick` with an offline queue, so
the aisle works with no signal and both phones converge. The `picks` and
`cart_state` tables already exist for it, so it is code only, no migration.

**Stage 3.** Pantry, recipe library and profiles migrate out of Notion; the
Access service token and `GET /api/planning-export` / `PUT /api/week` land, and
weekly builds stop being hand-assembled.

**Stages 4–5.** Receipt loop into R2, then the Clophie macro feed and the
scheduled build that starts the consecutive-automatic-weeks count.

## Publishing a week, today

```bash
node seed-week.mjs week.json 2026-08-30 "Sun 30 Aug – Mon 7 Sep 2026" > seed.sql
npx wrangler d1 execute clousto --remote --file=./seed.sql -y
```

Only one week may be `live` at a time — a partial unique index enforces it,
because two live weeks is how two phones end up reading different lists.

## If the week cannot be loaded

The page shows a red bar naming the reason and renders **nothing else**. It
never falls back to a stale or empty shopping list.

## Deploying

```bash
bash deploy.sh
```

`deploy.sh`, `access.mjs` and `domain.mjs` are identical across every app on the
platform; everything specific to this one is in `app.conf`. There is no build
integration and no CI — pushing to `main` deploys nothing.
