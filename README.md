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
| 🔴 [`docs/ingredient-vocabulary.md`](docs/ingredient-vocabulary.md) | **Draft awaiting review.** The canonical ingredient list that joins recipes to the pantry to the shops. Not yet in the database. |

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

**Stage 1 — done.** One durable URL, serving the live week read-only from D1.

- Ticks and picks are saved **on the phone only**. They do not sync to the other
  phone yet. The app says so rather than implying otherwise — a tick that
  silently fails to save is worse in an aisle than one that never claimed to.
- Publishing a week is `seed-week.mjs` plus a `wrangler d1 execute`.

**Stage 2 — next.** `POST /api/tick` and `/api/pick` with an offline queue, so
the aisle works with no signal and both phones converge. The `picks` and
`cart_state` tables already exist for it, so it is code only, no migration.

**Stage 3 — half done, 7 Sep 2026.** The **recipe library and pantry have migrated
out of Notion into D1** and are the system of record: 36 recipes with their full
verbatim method, 56 pantry rows with the evidence grading intact, served by
`GET /api/recipes` and `GET /api/pantry` and rendered by the app. Notion is no longer
authoritative for either, though the databases stay in place, stale, until Karl says
otherwise.

⚠️ **What did NOT migrate is the machine-readable half.** Structured ingredient
quantities still live inside `weeks.doc`, keyed on pack keys, bound to a week rather
than to a recipe — so the cart is still built from a frozen snapshot of the pantry
rather than a live diff against it. That join is the largest piece of outstanding work
and blocks the pre-cook checks and the post-cook decrement. See
[`docs/architecture.md`](docs/architecture.md) §4.

Profiles, the Access service token and `GET /api/planning-export` are still outstanding.

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
