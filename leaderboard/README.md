# Project Vacuum leaderboard (Cloudflare Worker + KV, free tier)

A tiny shared Top 10 for Project Vacuum. One Worker (`src/index.js`) and one KV namespace (`LEADERBOARD`).

| Endpoint | What it does |
|---|---|
| `GET /board` | Top 10 as JSON: `[{name, score, time, lured, webs, ver, at}]`, best score first (`at` = ms timestamp). |
| `POST /score` | Body (JSON, sent as `text/plain` by the game to skip the CORS preflight): `{name, score, time, lured, webs, ver, pulses[, empties]}`. Returns `{ok, rank, improved, top}` (`rank` = 1-10, or `null` if not in the top 10). |

Rules:
- Names: 1-16 characters, letters / digits / space / `_` / `-`.
- Scores: positive integers. Times: positive. Each score is checked against the game's own score formula (time×10 + lured×50 + webs×5 + pulses×60 + empties×150), so made-up numbers are rejected. Optional `empties` is accepted.
- Each name keeps only its best score (case-insensitive). The 50 best are stored and the top 10 are returned.
- Loose rate limit: 6 submissions per IP per minute.
- CORS: `https://silvertibby.github.io`, `localhost` / `127.0.0.1` (any port) and `file://` pages are allowed. More origins can go in `EXTRA_ORIGINS` in `wrangler.toml`.
- Cost: well inside the Workers and KV free tiers. Each GET is 1 KV read; each POST is about 2 reads and 1-2 writes.

## Deploy (about 5 minutes, needs a free Cloudflare account)

Run these from this folder (`leaderboard/`). Node 18+ is needed; `npx` downloads wrangler on first use (or install it once with `npm i -g wrangler` and drop the `npx`).

```bash
cd leaderboard
npx wrangler login                                # opens the browser: log in to Cloudflare and allow access
npx wrangler kv namespace create LEADERBOARD      # prints:  { binding = "LEADERBOARD", id = "<32-hex id>" }
#   -> paste that id into wrangler.toml in place of REPLACE_WITH_KV_NAMESPACE_ID
npx wrangler deploy                               # prints the URL, e.g. https://project-vacuum-leaderboard.<your-subdomain>.workers.dev
curl https://project-vacuum-leaderboard.<your-subdomain>.workers.dev/board   # should print []
```

Then copy the `https://...workers.dev` URL (no trailing slash) into `LEADERBOARD_URL` at the top of `prototype/game.js`, rebuild, and publish the game.

The first deploy may ask you to pick a `workers.dev` subdomain. That is free and you only do it once.

## Test locally (no account needed)

```bash
node test.mjs          # unit test with an in-memory KV mock
npx wrangler dev       # optional: local Worker at http://localhost:8787 (uses a local KV)
```

## Maintenance

- Reset the board: `npx wrangler kv key delete --binding LEADERBOARD board --remote`
- Look at it: `npx wrangler kv key get --binding LEADERBOARD board --remote`
