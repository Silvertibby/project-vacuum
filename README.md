# Project Vacuum

A tiny browser survival game. You are a bug inside a vacuum canister. You can't fight. Dodge, lure the other bugs into each other, and survive as long as you can.

**Play it: https://silvertibby.github.io/project-vacuum/**

## Controls

| Device | Move | Dash |
|---|---|---|
| Desktop | WASD / arrow keys | Space |
| Phone / tablet | Drag on the left half of the screen (floating joystick) | DASH button, bottom-right |

Other keys: R restart, P pause. On a phone, tap to start and restart, and use the small pause button at the top right.

## What's in it

- **Roach**: always chases you. Lure it into other bugs.
- **Wasp**: keeps its distance and fires stinger bursts. They hit other bugs too.
- **Spider**: slow; lays webs that catch you (-50%) and any bug that crosses them.
- **Beetle**: telegraphs, then charges in a line through anything.
- **Moth**: touch it to recruit it; it blocks one lethal hit.
- The filter in the middle is a danger zone. It swells on a rare vacuum pulse and drags you in.

Single-file HTML + canvas, no dependencies. Prototype.

## Shared leaderboard (optional)

`leaderboard/` is a Cloudflare Worker + KV Top 10 (free tier). Deploy it (see `leaderboard/README.md`), set `LEADERBOARD_URL` in the game source, rebuild, and republish. Until then the game stays fully offline.
