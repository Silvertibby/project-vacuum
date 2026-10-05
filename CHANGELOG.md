# Changelog

All notable changes to **Project Vacuum** are listed here, newest first.
The in-game version is the `VERSION` constant in `prototype/game.js` (tappable 'changelog' label on start and game-over, stored as `version` in each run record, exposed as `window.__vac.VERSION`).

**Play it:** https://silvertibby.github.io/project-vacuum/ (repo: https://github.com/Silvertibby/project-vacuum).

## [0.20.0] - 2026-10-05
### Added
- Top runs save a replay for later.

## [0.19.1] - 2026-10-05
### Changed
- Changelog trimmed to short player-facing notes (no balance / timing numbers).

## [0.19.0] - 2026-10-04
### Changed
- Empty is a one-use corner pickup (no more timed empties).
- Stronger filter suction during pulses.
- HUD shows EMPTY ready / wait / used.

## [0.18.3] - 2026-10-04
- High Scores on title + game over.
- Empty safe spot: any overlap counts.
- Longer empty warning.

## [0.18.2] - 2026-10-04
### Changed
- Leaderboard ranks by survival time.

## [0.18.1] - 2026-10-04
### Changed
- Shared Top 10 leaderboard enabled.

## [0.18.0] - 2026-10-04
### Added
- Stronger filter pulse (lure bugs near the core during suction).
- Canister EMPTY: telegraphed wipe with a green safe spot, then a heavy refill.
- Shared Top 10 on game over (optional).

## [0.17.0] - 2026-10-04
### Changed
- You stand out more (cyan rim, dash trail + landing ping).
- Soft pastel bug colors; you and recruited Moths stay bright.
- Webs clear in one pass.

## [0.16.0] - 2026-10-03
### Added
- Share button on title and game over.

## [0.15.0] - 2026-10-03
### Changed
- More frequent pulses.

## [0.14.0] - 2026-10-02
### Changed
- Rectangular arena that fills the screen.
- Early bugs are fragile; dust clumps can break.
- Slim HUD strip above the arena.

## [0.13.0] - 2026-10-01
### Added
- iPhone app mode (Add to Home Screen): icon, full screen, no Safari bar.

## [0.12.0] - 2026-10-01
### Changed
- Gentler, readable pulse scatter; linked webs stay linked.
- Webs never vanish on their own (only when you or a bug pass through).
### Added
- In-game changelog panel.

## [0.11.0] - 2026-10-01
### Changed
- Pulse scatters dust and webs instead of sucking them in.
### Added
- Version label on start / game over; CHANGELOG.md.

## [0.10.0] - 2026-10-01
### Added
- Stacking webs, webs-broken score, combined Score, run records.

## [0.9.1] - 2026-10-01
### Changed
- Recruited Moth is a shield on you only.

## [0.9.0] - 2026-10-01
### Changed
- Persistent webs (no timer; tear when crossed).
### Fixed
- Keyboard focus / blur hardening.

## [0.8.0] - 2026-10-01
### Added
- iPhone / touch controls (joystick, DASH, pause).

## [0.7.0] - 2026-10-01
### Changed
- Attacks overhaul: friendly fire, Wasp stingers, Spider webs, Beetle charge. Roach chase unchanged.

## [0.6.0] - 2026-10-01
### Changed
- Moths idle until touched (recruit by touch).

## [0.5.0] - 2026-10-01
### Changed
- Suction becomes a danger zone (lethal filter core, weak bug nudge).

## [0.4.0] - 2026-10-01
### Changed
- More bugs and debris; rarer pulses.

## [0.3.0] - 2026-10-01
### Changed
- Pulse gaps grow; trickle spawns; bigger waves.

## [0.2.0] - 2026-10-01
### Added
- Suction resistance for later bugs (later removed).

## [0.1.0] - 2026-10-01
### Added
- Initial prototype: five bug types, vacuum pulses, dash, survival time. Evasion only — lure bugs into each other.

## Design decisions from playtests
- Keep Roaches chasing. Pulses should feel special. Suction is a danger zone, not a whole-arena vacuum.
- Moths are recruited by touch and protect you. Bugs fight each other. It must play on an iPhone with reliable keys.
- Webs persist and count toward the score. Pulse effects must stay readable.
