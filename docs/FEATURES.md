# Completed Features

The single list of every feature that is **built and working**. Add a row whenever a feature is finished; never list
planned work here (that lives in `08-PROGRESS-TRACKER.md`). Newest phases at the bottom of each section.

Phase numbers match `08-PROGRESS-TRACKER.md`. "Where" points at the main code.

## Game modes

| Feature | Phase | Date | Where |
|---|---|---|---|
| Solo mode: one player, 3 difficulties, clear wave 30 to win, starts instantly | 11 | 2026-09-30 | `simulation/MatchSimulation.ts` |
| Versus mode: 2–4 players, own board each, identical seeded waves, last castle standing wins | 11 | 2026-09-30 | `simulation/MatchSimulation.ts`, `docs/09-VERSUS.md` |
| Versus timed waves (every 30 s, cleared or not) and per-wave income | 11 | 2026-09-30 | `simulation/systems/WaveSystem.ts` |
| Versus sends: grunt / runner / tank / flyer at an opponent, raises sender income | 11 | 2026-09-30 | `MatchSimulation.send` |
| Send targeting (next opponent or chosen player), incoming queue cap of 40 | 11 | 2026-09-30 | `MatchSimulation.send` |
| Knock-outs with placements (ties share a place), forfeit on leave or 60 s disconnect | 11 | 2026-09-30 | `MatchSimulation`, `RoomCoordinator.leave` |
| ~~Co-op mode (shared map and gold)~~ — removed in favour of versus | 11 | 2026-09-30 | — |
| Versus: healer, splitter and knight can be sent too (7 unit types, hotkeys Z–M) | 12 | 2026-10-01 | `shared/config/versus.ts` |

## Gameplay (simulation)

| Feature | Phase | Date | Where |
|---|---|---|---|
| Pure, deterministic simulation (seeded RNG, fixed 20 Hz tick, no I/O) | 3 | 2026-09-30 | `packages/simulation` |
| Grid maze pathing with BFS flow field; enemies re-route when towers change | 3 | 2026-09-30 | `shared/algorithms/flowField.ts` |
| Placement rules: can't seal the path, trap an enemy, build on enemies/rocks/spawn/goal | 3 | 2026-09-30 | `simulation/grid/Grid.ts` |
| Sell towers for 70% of everything invested | 3 | 2026-09-30 | `GameSimulation.sellTower` |
| 5 towers: arrow, cannon (splash, ground only), frost (slow), sniper, support (aura) | 4 | 2026-09-30 | `shared/config/towers.ts` |
| Tower upgrades to level 4 (+30% damage, +10% range per level) | 4 | 2026-09-30 | `GameSimulation.upgradeTower` |
| Targeting modes: first / last / strongest / closest | 4 | 2026-09-30 | `systems/TargetingSystem.ts` |
| Homing projectiles, armor (min 1 damage), non-stacking slow and aura | 4 | 2026-09-30 | `systems/*` |
| 5 enemies: grunt, runner, tank (armored), flyer (ignores maze), boss | 4 | 2026-09-30 | `shared/config/enemies.ts` |
| Budget-based wave generator with unlocks and a boss every 10th wave | 7 | 2026-09-30 | `systems/waveGenerator.ts` |
| Wave clear bonus; solo early-start bonus (not before boss waves) | 7 | 2026-09-30 | `systems/WaveSystem.ts` |
| Difficulties easy / normal / hard (enemy HP, start gold, lives) | 7 | 2026-09-30 | `shared/config/game.ts` |
| 2 maps: Meadow (2 spawns) and Canyon | 7 | 2026-09-30 | `shared/config/maps.ts` |
| Per-player stats: kills, damage, gold spent, towers built, enemies sent | 8 / 11 | 2026-09-30 | `simulation/world.ts` |
| Laser tower: continuous beam that ramps up to ×4 on one target | 12 | 2026-10-01 | `systems/FiringSystem.ts` |
| Tesla tower: lightning that chains to 3 more enemies | 12 | 2026-10-01 | `systems/FiringSystem.ts` |
| Mine Layer tower: drops mines on the path, ground enemies set them off | 12 | 2026-10-01 | `systems/MineSystem.ts` |
| Barricade: 25-gold wall for mazing | 12 | 2026-10-01 | `shared/config/towers.ts` |
| Level-3 tower branches: every attacking tower picks 1 of 2 specialisations | 12 | 2026-10-01 | `shared/config/towers.ts`, `GameSimulation.upgradeTower` |
| Status effects: burn (napalm), stun (paralyze), strongest-slow wins | 12 | 2026-10-01 | `systems/StatusSystem.ts` |
| Healer enemy: heals nearby enemies every second | 12 | 2026-10-01 | `systems/EnemyAbilitySystem.ts` |
| Splitter enemy: bursts into 3 runners when killed | 12 | 2026-10-01 | `systems/EconomySystem.ts` |
| Knight enemy: shield absorbs damage before HP | 12 | 2026-10-01 | `systems/damage.ts` |
| Boss abilities: summons grunts every 8 s, enrages once below 50% HP | 12 | 2026-10-01 | `systems/EnemyAbilitySystem.ts` |
| Perks: choose 1 of 3 every 5 waves (9 perks: damage, range, rate, discount, bounty, interest, …) | 12 | 2026-10-01 | `shared/config/perks.ts`, `GameSimulation.choosePerk` |
| 2 new maps: Crossroads (3 spawns) and Fortress (4 spawns, central castle) | 12 | 2026-10-01 | `shared/config/maps.ts` |

## Multiplayer and rooms

| Feature | Phase | Date | Where |
|---|---|---|---|
| Accounts: register, login (JWT, 7 days), bcrypt passwords, case-insensitive usernames | 2 | 2026-09-30 | `server/http/app.ts` |
| Rooms with 4-letter codes, join, ready-up, 3 s countdown, host force-start, host transfer | 2 | 2026-09-30 | `server/rooms/*` |
| Server-authoritative game loop at 20 Hz, commands queued and applied each tick | 5 | 2026-09-30 | `server/loop/GameLoop.ts`, `RoomGame.ts` |
| Zod validation of every socket payload, 10 commands/s rate limit per socket | 5 | 2026-09-30 | `server/sockets/index.ts` |
| Reconnect after refresh; slot kept 60 s; pause when everyone drops, close after 60 s | 9 | 2026-09-30 | `RoomCoordinator.ts` |
| Spectators (read-only, see every board) | 9 | 2026-09-30 | `RoomCoordinator.spectate` |
| In-game chat | 9 | 2026-09-30 | `RoomCoordinator.chat` |
| Delta snapshots (≈37–44% less bandwidth) | 9 / 11 | 2026-09-30 | `server/rooms/snapshotEncoder.ts` |
| Lobby mode picker (Versus / Solo); versus needs 2+ players | 11 | 2026-09-30 | `client/app/lobby`, `RoomManager.ts` |

## Client, graphics and sound

| Feature | Phase | Date | Where |
|---|---|---|---|
| Procedural art for every sprite (no image files): terrain, towers, enemies, castle, portals | 6 | 2026-09-30 | `client/src/game/art.ts` |
| Smooth movement via 100 ms snapshot interpolation | 6 | 2026-09-30 | `client/src/game/SnapshotBuffer.ts` |
| Placement ghost (green/red, same pathing check as the server) and range circles | 6 | 2026-09-30 | `game/placement.ts`, `GameScene.ts` |
| Animated path arrows, turret aiming and recoil, walking/flapping enemies, HP bars | 6 | 2026-09-30 | `GameScene.ts` |
| Effects: explosions, frost, coins, damage numbers, screen shake, wave/boss banners | 9 | 2026-09-30 | `GameScene.ts`, `WaveBanner.tsx` |
| Synthesized sound effects with volume and mute (remembered) | 9 | 2026-09-30 | `client/src/lib/audio.ts` |
| HUD: top bar, tower shop, tower panel (upgrade / sell / targeting), toasts | 6 | 2026-09-30 | `components/game/*` |
| Keyboard controls: 1–5, U, S, Esc, Space (solo), Z/X/C/V sends, Tab / Home board view | 6 / 11 | 2026-09-30 | `GameView.tsx` |
| Versus HUD: send panel, income, live opponent mini-boards, battle log | 11 | 2026-09-30 | `SendPanel.tsx`, `OpponentsPanel.tsx`, `FeedPanel.tsx` |
| Watch any opponent's board full size | 11 | 2026-09-30 | `GameScene.switchBoard` |
| Game-over summary (solo result, versus placements with medals) | 8 / 11 | 2026-09-30 | `GameOverModal.tsx` |
| Art for the new towers and enemies, shield bubbles, healer auras, mines | 12 | 2026-10-01 | `client/src/game/artExtra.ts` |
| Effects: laser beams, tesla lightning, mine blasts, splits, boss summon/enrage, burn/stun looks | 12 | 2026-10-01 | `GameScene.ts` |
| Branch picker in the tower panel and A/B badges on towers | 12 | 2026-10-01 | `TowerPanel.tsx` |
| Perk picker (can be tucked away with "Later") and perk icons in the top bar | 12 | 2026-10-01 | `PerkPanel.tsx`, `TopBar.tsx` |
| Shop with 9 towers (keys 1–9), prices after perk discounts | 12 | 2026-10-01 | `TowerShop.tsx` |

## Stats and persistence

| Feature | Phase | Date | Where |
|---|---|---|---|
| Postgres schema + migration runner (001–003), maps seeded automatically | 2 / 8 / 11 | 2026-09-30 | `server/src/db/*` |
| Matches saved at game end in one transaction, retried once on failure | 8 | 2026-09-30 | `RoomCoordinator.persist` |
| Solo leaderboard per map and difficulty (waves, then time) | 8 | 2026-09-30 | `/leaderboard`, `client/app/leaderboard` |
| Versus ranked leaderboard (wins, then fewer games) | 11 | 2026-09-30 | `/leaderboard?mode=versus` |
| Profile page (solo and versus stats) and match history | 8 / 11 | 2026-09-30 | `client/app/profile`, `client/app/history` |
| Local Postgres without Docker (`npm run db:start`), in-memory fallback for quick play | 1 | 2026-09-30 | `server/src/db/devPostgres.ts` |

## Tooling and operations

| Feature | Phase | Date | Where |
|---|---|---|---|
| Monorepo (npm workspaces), strict TypeScript, ESLint, Prettier, Jest (161 tests) | 1 | 2026-09-30 | root |
| Balance bot: plays hundreds of solo games with scripted strategies | 7 | 2026-09-30 | `simulation/tools/balance-bot.ts` |
| Socket load test (25 rooms ≈ 0.09 ms per tick) | 10 | 2026-09-30 | `tools/load-test.ts` |
| Dockerfiles, production compose with Caddy (HTTPS), CI workflow | 10 | 2026-09-30 | `packages/*/Dockerfile`, `.github/workflows/ci.yml` |
| Health endpoint with metrics, JSON logs, tick-time alert, helmet, CORS, auth rate limits | 10 | 2026-09-30 | `server/http/app.ts`, `metrics.ts` |
| Balance bot uses branches and perks; `--breakdown` shows damage share per tower | 12 | 2026-10-01 | `simulation/tools/balance-bot.ts` |

## Notable fixes

| Fix | Date |
|---|---|
| `npm run db:start` no longer stops an already-running Postgres | 2026-09-30 |
| Leaving from the game-over screen no longer bounces to the lobby | 2026-09-30 |
| Boss/healer abilities no longer fire one tick late (floating-point timer) | 2026-10-01 |
