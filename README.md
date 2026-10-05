# Project Vacuum (working title)
Real-time, solo battle-royale survival inside a handheld vacuum canister. You're a bug. Every so often the human vacuums again, adding more bugs and obstacles. Last as long as you can.

## Locked
- Real time (not choice/turn-based)
- Solo for now
- Threat: other bugs either fight each other (you watch/dodge) or all hunt you
- Vacuum pulses = the "storm circle": pacing, new bugs, new obstacles

## Open
- Combat: do you fight, or only evade?
- Camera/controls
- The vacuum itself as a hazard (suction, filter, dust)
- Win/score: survival time only?

## Inbox
(thoughts go here)

- (09-29) Player is evasion-only, bullet-hell feel. No direct attack.
- (09-29) Strategy layer: lure bug types into each other. Bug types have different mechanics.
- (09-29) Bug behavior axes: passive vs aggressive; hunters; defenders-only; allies; mutual enemies.

## Shared leaderboard (optional)

`leaderboard/` is a tiny Cloudflare Worker + KV that keeps a Top 10 ranked by survival time (free tier). The title screen has a High Scores button; on game over a clean High Scores panel replaces the results screen (name + submit). See `leaderboard/README.md` for the deploy steps, then set `LEADERBOARD_URL` at the top of `prototype/game.js` to the Worker URL and rebuild. Leave it empty for offline play.
