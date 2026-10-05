# Changelog

All notable changes to **Project Vacuum** are listed here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are semver-ish (one minor per iteration).
The in-game version is the `VERSION` constant in `prototype/game.js` (shown small, as a tappable 'changelog' label, on the start and game-over screens,
stored as `version` in each `vacuum_runs` record, and exposed as `window.__vac.VERSION`).

This history was reconstructed after the fact. All dates are 2026-10-01 and the times (PT) are approximate.

**Play it:** published to GitHub Pages at https://silvertibby.github.io/project-vacuum/ (repo: https://github.com/Silvertibby/project-vacuum).
Note: the Pages build tracks `index.html` on `main`. See the repo for whether the latest version has been pushed yet.

## [0.18.3] - 2026-10-04 (~23:45 PT)

- **Title High Scores:** a clean "High Scores" button on the START screen opens Top 10 (GET `LEADERBOARD_URL/board` when the title shows / when opened). Failed fetch or offline → hide / show "offline".
- **Game-over High Scores:** when the shared board is on, a clean modern High Scores panel **replaces** the game-over screen (run summary, Top 10, name + Submit, Play again). No CRT / arcade side card.
- **Empty overlap-safe:** player is safe if any part of the player circle intersects the green spot (`distance < safeR + player.r`), not center-only. Bonded moths still live/die with the player.
- **Empty telegraph:** warn time 5.2 s (was 4.2 s). Empty timing gaps unchanged (first 55–70 s, then 50–70 s, delay if pulse).

## [0.18.2] - 2026-10-04 (~23:40 PT)
### Changed
- Shared leaderboard now ranks by **survival time** (longest first, best time per name); the arcade card shows times as `1ST  BEN  01:42.3` and `YOUR TIME / BEST`. Score and stats are still submitted and stored for display; score plausibility is now a soft check (implausible → stored as `null`, never rejected). Worker redeployed.

## [0.18.1] - 2026-10-04 (~23:20 PT)
### Changed
- Enable shared arcade leaderboard URL: `LEADERBOARD_URL` = `https://project-vacuum-leaderboard.silvertibby.workers.dev` (Worker deployed, KV namespace id set in `leaderboard/wrangler.toml`). No gameplay changes.

## [0.18.0] - 2026-10-04 (~23:30 PT)
Strategy pass + shared arcade leaderboard. Live Pages was still on v0.17, so this ships as one clean 0.18.
### Added
- **Stronger filter pulse (risk / reward).** Bug pull is ~2.3x the old nudge (`bugPull` 42 + 7·lvl, cap 105 px/s; was 18 + 3·lvl, cap 45), with an extra near-core boost (`bugNear` 0.9 within 190 px). Player pull caps stay 100→170; near-core boost is now +65% within 160 px (was +50% within 150). During a pulse (`pullEnv > 0`) EVERY bug — Roach included — also FLEES radially away from the filter at 1.3× its base pull; bonded Moths and spawn-protected bugs are exempt. Far out, flee beats pull and bugs escape; inside ~127 px of the filter centre the near-core pull wins, so a bug you lure near the filter during suction slowly loses and dies on the core. Non-Roach `avoidVec` still runs outside a pulse; during a pulse it fades with the envelope and the flee takes over. Roach chase AI itself is untouched. Bugs still die on core contact.
- **Canister EMPTY (all-clear wipe).** Rare telegraphed event: first empty at 55–70 s, then every 50–70 s. Never during an active pulse or its warning (delayed until the pulse ends + 2.5 s). ~4.2 s telegraph: rumble/shake, "EMPTYING…" / "CANISTER EMPTYING", and ONE flashing GREEN safe spot (r 64) on the far side of the arena from the player at telegraph start (a corner/pocket near the opposite wall, never under the filter, and at most 720 px away so it is reachable). On wipe: remove almost everything not in the green radius (bugs, dust, webs, stingers); the player dies outside it; bugs inside the spot survive; bonded Moths live only if the player is safe. Brief aftershock (shake + particle burst). Surviving an empty = +150 score; empties are counted on the HUD, game-over and run record. Then a **HEAVY refill**: `min(40, 10 + t/8)` bugs spawn over 2.5 s as if 60 s later in the run (tougher hp), plus 5 dust clumps, telegraphed with + markers — late-game difficulty stays high, not a quiet reset.
- **Old-arcade Top 10** on the game-over card (when `LEADERBOARD_URL` is set): neon CRT-ish panel, monospace "HIGH SCORES" / "TOP 10", ranks as `1ST  BEN  004850`, flashing "ENTER YOUR INITIALS", "INSERT COIN" submit. Offline (`LEADERBOARD_URL = ''`) is unchanged: no card, no network. The Worker in `leaderboard/` accepts an optional `empties` field and allows +150 per empty in the score plausibility check.
### Changed
- Score formula: `… + pulses×60 + empties×150`. Run records store `empties` / `emptiedBugs`.
- Start screen and legend mention the stronger pulse lure and the canister empty.
### Tests
- `leaderboard/test.mjs` (worker) and `chrome/lb.js` (arcade card, offline mode) plus new `empty.js` / updates to `pulse.js` for stronger drag, flee-but-suck, empty telegraph + opposite safe spot + wipe + player die outside + heavy refill.
## [0.17.0] - 2026-10-04 (~21:50 PT)
Playtest feedback from Ben: he loses track of himself in busy late game (especially after a dash); other bugs should be a soft but clearly visible pastel palette
while he and his recruited Moths pop; and webs can go after a single pass.
### Changed
- **Player visibility** (visual only, no gameplay change):
  - The player is a white body with a saturated cyan rim (`rgb(47,243,255)`, used by nothing else) and a cyan glow, on a dark radial contrast plate (so it reads on pale webs and dust),
    with an always-on pulsing ground halo ring (r 22). The rim flashes white while invulnerable.
  - It is drawn after bugs, webs, debris, stingers and particles, so it is always on top. Particles within 30 px of the player are drawn at 30% opacity.
  - Dash: a tapered cyan + white trail from the dash start point to where you are (fades 0.5 s after landing, with a small ring marking the start), then a locator ping at the landing
    spot: a brief white flash and a cyan ring expanding from 10 to 58 px over 0.6 s.
  - When crowded (2+ bugs / clumps / a web right around you) a small bobbing cyan arrow points down at the player.
  - The recruited-Moth shield ring is brighter and thicker; the cooldown arc is unchanged.
- **Palette.** Roach, Wasp, Spider, Beetle and unrecruited Moths are light, high-value pastels with a crisp darker same-hue outline: Roach peach `#ffb59e`, Wasp lemon `#fff0a0`,
  Spider lilac `#dcc2ff`, Beetle mint `#b4f2c6`, unrecruited Moth sky `#c6ecf7` (soft glow, beacon ring kept so it can still be found). They are fully opaque and bright, not dimmed.
  Recruited Moths are saturated cyan `#19e6ff` with a white outline and a strong glow. Telegraphs stay saturated: Wasp aim lines and glow, Spider red eyes and lunge line,
  Beetle orange windup ring and orange charging body, stingers, spawn markers.
- **Webs go in one pass.** Any completed pass (the player stepping off or standing 1 s; a non-Spider bug breaking free) removes the web entirely, whatever its layers.
  Layers still raise the slow (50% -> 65%) and the bug stuck time (+0.3 s per extra layer), Spiders are still immune, never remove webs and still stack layers (max 4).
  Only the webs actually passed through are removed; the rest of a linked cluster stays (links are recomputed from the surviving webs).
- **Webs broken** now counts 1 per web removed (it counted each layer). Score weights are unchanged (x5 by you, x2 by bugs), so web points per multi-layer web are lower.
### Tests
- `web.js` updated for one-pass webs (player and bug passes remove multi-layer webs, counted once; more layers still hold bugs longer; linked chain keeps uncrossed webs; Spider never removes).

## [0.16.0] - 2026-10-03 (~20:50 PT)
### Added
- **Share button** on the start screen and the game-over screen (bottom right, a blue pill with a share icon; at least 44 css px tall, sized up on small screens, kept inside the safe areas, clear of the changelog label).
  Tap / click it to share the game: `navigator.share({title: 'Project Vacuum', text: 'Try this bug survival game!', url})` when available (iOS Safari and app mode); otherwise the link is copied
  (`navigator.clipboard.writeText`, then a hidden textarea + `document.execCommand('copy')`) and a "Link copied!" toast shows for ~2 s; if both fail, a small box shows the link pre-selected so it can be copied by hand
  (Close button, Esc, or tap outside; the box is modal for the keyboard). The URL is always the canonical https://silvertibby.github.io/project-vacuum/, never `location.href` (which may be a `file:` / `data:` URL).
  Cancelling the share sheet (`AbortError`) does nothing; any other share error falls back to copying.
  The button acts on release (iOS requires a real tap-up for the share sheet), swallows the tap so it never starts or restarts the game, and is hidden during play, so keyboard, joystick, DASH, pause, HUD, arena and app-mode safe-area handling are unchanged.
### Tests
- New `chrome/share.js`: mocks `navigator.share` / `clipboard` / `execCommand`; checks the exact share args, silent cancel, each fallback, the URL box, toast timing, no page errors, and that the button is tappable (touch) on 390x844 and 844x390 and on the game-over screen.

## [0.15.0] - 2026-10-03 (~20:30 PT)
Playtest feedback from Ben: try weaker-but-more-frequent vacuum pulses.
### Changed
- **More frequent pulses.** First pulse at 20 s (was 28 s). The gap between pulse starts is `min(40, 18 + 2n)` after pulse n: 20, 22, 24, 26 ... 40 s (cap reached at pulse 11);
  it was `min(70, 26 + 6n)`: 32, 38 ... 70 s. The 3.5 s warning, the 4 s spawn protection, the scatter / rearrange and the pull strength at pulse 1 (player 105 px/s, bugs 19.5 px/s) are unchanged.
  The longest pulse (6 s) plus warning (3.5 s) is well under the shortest gap (20 s), so there is always a quiet stretch between pulses.
- **Pulse strength ramps at half the rate per pulse** (new `T.lvl(n) = 0.5 n`) for core radius (24 -> 40), player / bug pull (100 -> 170 / 18 -> 45 px/s), pulse length (3.5 -> 6 s) and the Roach speed bonus.
  Pulses come about twice as often, so this keeps the strength at a given time in the run roughly where it was; the caps are unchanged. Roach chase logic is unchanged.
- **Wave size** at each pulse is `min(16, 5 + floor(1.5 n))` bugs (was `min(18, 6 + 2n)`) plus the same 3-4 dust clumps; trickle spawns and caps are unchanged.
- **Score:** pulse survival bonus is 60 per pulse (was 100) so pulses are still worth about the same share of the score (~2.4 vs ~2.6 points/s at the cap). Best scores saved before v0.15 are not comparable for long runs.
### Tests
- New `pulse.js` (schedule, gaps, warning, pull strength, wave size and spawn protection over a 330 s run). `web.js` score check now reads `T.score.pulse`.
- Harness (dodge-bot, N=40): median survival 49.7 s, 1.8 pulses per run (was 38.1 s median / 0.9 pulses in the same session).

## [0.14.0] - 2026-10-02 (~14:45 PT)
Playtest feedback from Ben: early friendly fire should kill bugs easily, debris needs a way to disappear, and the play field should be a rectangle that
uses more of the screen. (Roach chase and the pulse rearrange behaviour are loved, so they are untouched. Webs are untouched.)
### Changed
- **Bug hp / damage ramp.** Every bug (except the Moth) gets `hp = base * hpMult(t)` when it spawns, where `hpMult` is 0.45 at t=0, rises linearly to 1.0 at t=90 s,
  then `min(2.2, 1 + (t-90)/260)` (about 1.8x at 5 min). Early Wasp 5 -> 2.25 hp, Spider 7 -> 3.15, Beetle 4 -> 1.8; at 5 min they are 9.0 / 12.7 / 7.2.
  Bug-vs-bug damage (stingers, charges, lunges) is multiplied by `max(1, hpMult)^0.85` of the attacker (about 1.65x at 5 min), so late fights are tougher but not instant.
  Damage to the player is unchanged. Damaged bugs show a small health bar. The Roach (1 hp early) and its chase behaviour are unchanged.
- **Rectangular arena.** The circular canister is replaced by a rounded rectangle (corner radius 40). Its area is fixed at ~400,000 logical px2 and its shape follows the
  screen: it is sized from the viewport minus safe-area insets, a 52 px HUD strip and a 10 px margin (24 px at the bottom on desktop), with the aspect clamped to 0.5-2.6, so it
  covers ~80-85% of a phone (portrait or landscape) and fills the desktop window. Rotating or resizing refits it (everything is clamped / nudged back inside).
  Bugs and the player clamp at the walls like the old rim; stingers die at the wall; wander, spawn rim, wave placement, web / debris placement, scatter targets and streaks all use the rectangle.
  The filter stays in the centre (danger zone logic and pulse pull direction unchanged). Rendering: rounded-rect canister with dust, rim highlight and a rounded-rect pulse warning.
- **HUD** is now a slim strip above the arena, drawn in screen pixels inside the safe area (time, pulses / lured kills / webs broken / bugs / dust, best, pulse banner). Start, game-over,
  pause and changelog overlays and the touch joystick / DASH button are unchanged.
### Added
- **Debris durability.** Each clump has durability `3 + 0.3 * radius` that wears with: bug contact 0.15 (x attacker damage mult), player 0.2 (dash 0.8), stinger 1, lunge 1.5, charge 2.5
  (0.3 s per-clump cooldown). It shrinks to 62% of its radius, shows cracks and a hit flash, then pops with a small particle burst and ring.
- **Filter core destroys debris**: a clump whose centre gets within the core radius (+35% of its own radius) pops. At a pulse, one clump already close to the filter (within the danger zone + 60 px)
  has a 60% chance of being dragged in and destroyed; other clumps are rearranged exactly as before.
- Debris trickle runs 2x faster while fewer than 8 clumps remain (cap still 16), so the field neither clogs nor empties. Webs are never destroyed.
### Fixed
- Webs are never laid outside the walls; a wall clamp is the last step of keep-in and of group settling.
### Tests
- New `arena.js` (arena size per viewport and safe area, walls, 130 s containment on 7 viewports, spawns, resize / rotation refit, hp ramp, friendly fire, debris durability,
  pulse eat chance, debris count). `web.js`, `t.js` updated for the rectangle.

## [0.13.0] - 2026-10-01 (~19:00 PT)
### Added
- **App mode (iPhone "Add to Home Screen").** From https://silvertibby.github.io/project-vacuum/ in Safari, Share > Add to Home Screen now
  gives the game a proper icon and name ("Vacuum") and launches it full screen with no Safari bar.
  - `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`,
    `apple-mobile-web-app-title="Vacuum"` and `theme-color` (#07080c, the game background) in the page head; `viewport-fit=cover` was already there.
  - A bug-themed icon (dark canister, glowing Roach, orange hazard ring) as a 180x180 `apple-touch-icon`, a 64x64 favicon and a 512x512
    manifest icon. The icons and a web manifest (name, short_name, `display: fullscreen` with a `standalone` fallback, background / theme colour,
    `start_url` "./", icons) are embedded as `data:` URIs, so the build is still a single HTML file. Reference PNGs: `upload/icon-180.png`, `upload/icon-512.png`.
### Changed
- Standalone hardening: no text selection, image dragging, long-press callout or double-tap zoom (extra `selectstart` / `dragstart` / `dblclick` guards on top
  of the existing no-scroll, no-bounce, no-pull-to-refresh setup). The existing safe-area handling positions the HUD and touch buttons inside the notch and
  home-indicator insets, which matters with the translucent status bar. No gameplay changes.

## [0.12.0] - 2026-10-01 (~16:00 PT)
### Changed
- **Gentler, readable pulse scatter.** Dust clumps and webs no longer fly and bounce. Each one slides a short, eased distance
  (60-150 px over ~1.5-2 s, friction-like stop) to a new spot. Targets are checked up front (inside the arena, outside the largest
  danger zone, off the player's spawn point), so there is no rim or zone bouncing; any leftover overlap is fixed by a small nudge when
  the slide settles. The layout is only mildly randomized.
- Cleaner pulses: the motion trails and streak lines are gone (a flying clump only fades softly), the suction streaks are fainter,
  and the screen shake at pulse start is much smaller, so bugs and stingers stay easy to see.
- **Linked webs stay linked.** Webs are grouped into connected clusters (adjacent within ~22 px, which covers a Spider's trail) and each
  cluster slides as one rigid unit with the same displacement for every web, so chains and shapes survive a pulse. Link strands are
  drawn between adjacent webs so the linking reads visually. Nothing fragments.
- **Webs never disappear on their own.** The cap eviction of the oldest web is removed. The cap is raised from 120 to 200, and at the cap
  Spiders simply stop laying new webs (stacking onto an existing web still works). Nothing else removes a web: no timers, no pulse
  consumption, no core overlap (a web or clump on the core is nudged out as a rigid group, never destroyed). A web is removed only when
  its layers are cleared by a pass from the player or a non-Spider bug.
### Added
- **In-game changelog panel.** The version label on the start and game-over screens now reads "vX.Y.Z - changelog" and opens a scrollable
  panel (mouse wheel, touch drag, arrow keys / W / S / PageUp / PageDown) with the condensed history, closed by the Close button, Esc, C or a
  tap outside it. It is modal, so it never starts the game or drives the controls. `window.__vac.CHANGELOG` holds the text.

## [0.11.0] - 2026-10-01 (~15:30 PT)
### Changed
- The vacuum pulse no longer sucks dust clumps and webs into the filter. It now **scatters** them: a swirl plus random impulses
  shove each one outward or sideways, they bounce off the rim and the danger zone, fly with motion trails, and settle at new
  random positions with a dust puff. The layout of debris and webs is re-randomized every pulse.
- Nothing is destroyed: clump and web counts stay the same and webs keep their layers. Debris stays out of the filter danger zone
  and off the player's spawn point, and anything on the core is nudged out.
### Added
- Versioning: `VERSION` constant, small version label on the start and game-over screens, `version` in every saved run record.
- This changelog (also copied into `prototype/` and the tarball) and a "Version history" pointer in `PITCH.md`.
- Legend line about the pulse blasting dust and webs around.

## [0.10.0] - 2026-10-01 (~15:00 PT)
### Added
- **Stacking webs:** a Spider laying a web on top of an existing one adds a layer (strength, cap 4). Each pass by the player
  or a bug removes one layer and the web only tears at 0. Higher layers slow the player more (50% on layer 1, up to 65%),
  keep bugs stuck longer, and are drawn denser, thicker and brighter with an "xN" label.
- **Web score:** "Webs broken" (every layer cleared) on the HUD and the game-over stats, split into webs broken by you (credit)
  and by bugs (counted, weighted less).
- **Provisional combined Score** on game over: time x10 + lured kills x50 + webs by you x5 + webs by bugs x2 + pulses x100.
  Best score is stored separately (`vacuum_best_score`) from best time (`vacuum_best`).
- **Run records** (`vacuum_runs`, last 25): time, pulses, lured kills, webs broken (you/bugs), bugs killed, lost to the filter, score, cause.
### Unchanged
- Survival time is still the main score. Roach chase code untouched.

## [0.9.1] - 2026-10-01 (~14:30 PT)
### Changed
- **Moth is a shield on the player only.** A recruited Moth is an invulnerable escort: it ignores stingers, charges, lunges, webs,
  bug fights and the filter. It is consumed only when a lethal hit actually reaches the player (shield-break effect, attacker
  stunned, brief grace window). An unrecruited Moth shields nobody.

## [0.9.0] - 2026-10-01 (~14:00 PT)
### Changed
- **Persistent webs:** webs no longer time out. They stay until crossed; a caught bug is stuck for about 1 s and then the web tears;
  the player is slowed and tears the web on leaving or after 1 s. Cap of 120 webs (oldest dropped).
### Fixed
- **Keyboard hardening:** keys read by `e.code` with an `e.key` fallback, listeners on window and document, focusable canvas and body
  re-focused on load/click, blur pauses with a clear "Window lost focus" overlay (any key or click resumes), a real keydown clears
  touch mode, and the start screen shows "keys: ok" once a key is seen.

## [0.8.0] - 2026-10-01 (~13:15 PT)
### Added
- **iPhone / touch controls:** floating joystick, DASH button with cooldown ring, pause button, responsive scaling for portrait and
  landscape at any pixel ratio, safe-area insets, audio unlock on first touch, no scroll / zoom / rubber-banding.

## [0.7.0] - 2026-10-01 (~12:30 PT)
### Changed
- **Attacks overhaul:** per-type aggro radius and leash, **friendly fire** (stingers, charges and lunges hit whatever is in the way),
  Wasp stingers, Spider webs (slow the player 50%), Beetle is charge-only, even spawn mix, HP rebalance.
### Unchanged
- Roach chase: Roaches still always chase the player.

## [0.6.0] - 2026-10-01 (~12:00 PT)
### Changed
- Moths idle in place until touched (recruit by touch) instead of flocking, with a pulsing glow and a slow beacon ring so they can be found.

## [0.5.0] - 2026-10-01 (~11:30 PT)
### Changed
- **Suction reworked into a danger zone:** only a weak nudge on bugs, a lethal filter core with a visible orange hazard zone that swells on a pulse,
  4 s of spawn protection for new bugs, easier opening population.
### Removed
- Suction resistance (armor rings) from 0.2.0.

## [0.4.0] - 2026-10-01 (~11:00 PT)
### Changed
- More bugs and debris; much rarer pulses (first at 28 s, gaps of 32 s growing toward a 70 s cap).
- Bug cap 45, clump cap 16, time-based escalation of the trickle spawns.

## [0.3.0] - 2026-10-01 (~10:30 PT)
### Changed
- Pulse gaps grow longer over the run; continuous trickle spawns between pulses; bigger spawn waves per pulse.

## [0.2.0] - 2026-10-01 (~10:15 PT)
### Added
- Suction resistance for later-spawned bugs (armor rings).

## [0.1.0] - 2026-10-01 (~10:00 PT)
### Added
- Initial prototype: five bug types (Roach, Wasp, Spider, Beetle, Moth) in a circular canister with a filter; vacuum pulses as a
  storm-circle style event with a telegraph (rim flash, contracting rings, countdown, spawn markers); dash with brief i-frames;
  survival time with best time in localStorage.
- README design: evasion-only (you cannot attack); lure bugs into each other.

## Design decisions from playtests
Paraphrased feedback from playtesting, and what it changed:
- **Keep the Roaches chasing.** Roach chase behavior is the baseline threat; changes to other bugs must leave it alone (it has stayed untouched since 0.1.0).
- **Pulses should be rare.** Pulses were too frequent and too punishing, so they became rare events (0.4.0).
- **Suction should be a danger zone, not a vacuum.** The pull is weak; the filter is a hazard area with a lethal core, not something that hoovers the whole arena (0.5.0).
  Later, even dust and webs are scattered rather than sucked in (0.11.0).
- **Moths should be recruited by touch**, not chase you around (0.6.0), and **should protect the player**, not get hurt by bugs (0.9.1).
- **Bugs should fight each other, not just you**, hence aggro ranges and friendly fire (0.7.0).
- **The keyboard must work reliably**, hence the focus / blur / key-fallback hardening (0.9.0).
- **It should play on an iPhone** (0.8.0).
- **The pulse scatter must be readable, not chaotic.** Bouncing debris was too crazy to follow, so 0.12.0 replaced it with a short eased slide, kept linked webs together and cut the shake and trails.
- **Webs must never vanish on their own**, only by being passed through (0.12.0: no eviction, cap 200).
- **Webs should persist and be worth something**, so they no longer expire, they stack, and breaking them counts toward the score (0.9.0, 0.10.0).
