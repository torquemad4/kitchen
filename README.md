# Clousto Kitchen

`kitchen.torquemada.uk`. Cloudflare Pages + Pages Functions + D1, behind
Cloudflare Access. The week's shopping list and every recipe card, on a URL
that does not move.

## Documentation

Full documentation is in [`docs/`](docs/). It is the single source of truth.

| | |
|---|---|
| ⭐ [`docs/READ-FIRST.md`](docs/READ-FIRST.md) | **Read before changing anything.** Orientation, the invariants, and which documents a given change obliges you to update. |
| [`docs/architecture.md`](docs/architecture.md) | The loop, stage ownership, the data model, known-broken. |
| [`docs/user-guide.md`](docs/user-guide.md) | How Karl and Maria use it. |
| [`docs/code.md`](docs/code.md) | Repo layout, endpoints, `index.html` internals, deploying, testing. |
| [`docs/ingredient-vocabulary.md`](docs/ingredient-vocabulary.md) | ✅ Reviewed and signed off, kept for the record. The **live** list is the `ingredients` table; where they differ, the table wins. |

Operating skills: `~/projects/skills/clousto` (safe reads and writes),
`clousto-menu` (the weekly menu conversation), `clousto-receipt` (receipt → pantry).

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

**Stage 1 — done.** One durable URL, serving the live week from D1.

**Stage 2 — done.** Ticks and picks sync between both phones through
`GET`/`POST /api/state`, with an offline outbox in localStorage so the aisle works
with no signal. Last write wins, enforced in SQL.

**Stage 3 — done, 7 Sep 2026.** The **recipe library and pantry migrated out of Notion
into D1** and are the system of record: 38 recipes with their full verbatim method and
89 pantry rows with the evidence grading intact, served by `GET /api/recipes` and
`GET /api/pantry`. Notion is no longer authoritative for either, though the databases
stay in place, stale, until Karl says otherwise.

✅ **The machine-readable half followed the same day.** `ingredients` (139) and
`recipe_ingredients` (297) join a recipe ingredient to its pantry row and to a buyable
pack, `GET /api/stock` serves that join, and the published week now carries per-option
`use` maps. **The cart is computed from the dinners you picked and reconciled against
the live pantry** — see [`docs/architecture.md`](docs/architecture.md) §2.1 and §4.

⚠️ **What is still missing is the way back in.** Nothing tells the pantry what came home
from the shop, so its rows drift until someone restates them out loud. Stage E — the
receipt loop — is the next piece of real work, and the pre-cook checks and post-cook
decrement sit behind it.

Profiles, the Access service token and `GET /api/planning-export` are still outstanding.

**Stages 4–5.** Receipt loop into R2, then the Clophie macro feed and the
scheduled build that starts the consecutive-automatic-weeks count.

## Publishing a week, today

```bash
node seed-week.mjs week.json 2026-09-08 "Tue 8 – Mon 14 Sep 2026" > seed.sql
npx wrangler d1 execute clousto --remote --file=./seed.sql -y
```

Or `PUT /api/week`, which is what the menu conversation uses — it validates the
document before it lands and refuses a week that would render a bad list.

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
