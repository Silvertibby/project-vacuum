# Project Vacuum leaderboard (Cloudflare Worker + KV, free tier)

A tiny shared Top 10 for Project Vacuum, ranked by **survival time** (longest first). One Worker (`src/index.js`) and one KV namespace (`LEADERBOARD`).

| Endpoint | What it does |
|---|---|
| `GET /board` | Top 10 as JSON: `[{name, time, score, lured, webs, pulses, empties, ver, at[, rid]}]`, longest time first (ties: earliest run; `at` = ms timestamp; `rid` = replay id, Top 5 only). |
| `POST /score` | Body (JSON, sent as `text/plain` by the game to skip the CORS preflight): `{name, time, score, lured, webs, ver, pulses[, empties, replay]}`. Returns `{ok, rank, improved, replaySaved, top}` (`rank` = 1-10, or `null` if not in the top 10). |
| `GET /replay/<rid>` | The stored replay JSON for a Top-5 entry (404 once it has dropped out). |

Rules:
- Names: 1-16 characters, letters / digits / space / `_` / `-`.
- Ranking key: `time` (seconds survived, 0.1-36000, stored to 0.1 s). It is the only required stat; a missing or bad time is rejected.
- `score`, `lured`, `webs`, `pulses`, `empties`, `ver` are stored for display only. The score is soft-checked against the game's own formula (time×10 + lured×50 + webs×5 + pulses×60 + empties×150): a missing, malformed or implausible score is stored as `null`, never rejected and never used for ranking. Obviously impossible stats (e.g. more webs than the time allows) are still rejected.
- Each name keeps only its longest time (case-insensitive). The 50 longest are stored and the top 10 are returned.
- Replays (v0.20): `replay` = `{v:1, ver, hz:60, seed, w, h, tm, n, t, full, d}` (seed + arena size + touch flag + tick count + a base64 input log, see the 'replay recording' comment in `prototype/game.js`). It is optional and soft-checked (bad shape, `d` over 90,000 chars, or `n/hz` more than 1 s off `time` -> dropped, the score still counts). Only the Top 5 keep one, each under its own KV key `replay:<rid>` so `/board` stays small; a run pushed to rank 6+ or replaced by a longer run under the same name has its replay deleted. Request bodies are capped at 100 KB.
- Loose rate limit: 6 submissions per IP per minute.
- CORS: `https://silvertibby.github.io`, `localhost` / `127.0.0.1` (any port) and `file://` pages are allowed. More origins can go in `EXTRA_ORIGINS` in `wrangler.toml`.
- Cost: well inside the Workers and KV free tiers. Each GET is 1 KV read; each POST is about 2 reads and 1-2 writes, plus 1 write for a new Top-5 replay and 1 delete per replay that drops out.

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
- Replays: `npx wrangler kv key list --binding LEADERBOARD --prefix replay: --remote` (resetting the board leaves these behind; delete them too).
