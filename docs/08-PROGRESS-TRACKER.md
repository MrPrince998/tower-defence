# 08 — Progress Tracker

Current phase: **13 (social)** — Phase 12 (gameplay depth) done

- [x] Phase 1 — Project setup
- [x] Phase 2 — Auth and lobby
- [x] Phase 3 — Simulation core
- [x] Phase 4 — Towers and combat
- [x] Phase 5 — Server loop and networking
- [x] Phase 6 — Phaser client
- [x] Phase 7 — Waves and balance
- [x] Phase 8 — Persistence and leaderboard
- [x] Phase 9 — Polish and reconnect
- [x] Phase 10 — Testing and deploy (all deliverables in repo; not yet deployed to a public URL)
- [x] Phase 11 — Versus mode replaces co-op; solo mode (see `09-VERSUS.md`)
- [x] Phase 12 — Gameplay depth: healer / splitter / knight enemies, boss abilities, level-3 tower branches,
      new towers (laser, tesla, mine layer, barricade), perks every 5 waves, 2 new maps
      (not done from the original idea list: enemies attacking towers, destructible barricades)
- [ ] Phase 13 — Social: replays (match_commands), public lobby browser + quick match, invite links, quick-chat/emotes
- [ ] Phase 14 — Progression: achievements + XP levels, cosmetic tower skins / castle themes, daily challenge
      (fixed seed + rule, own leaderboard), endless mode with modifiers
- [ ] Phase 15 — Polish: synthesized music (boss theme), weather/night waves, wave summary + damage heatmap,
      kill streaks, tutorial, practice bot opponent, touch controls

## Notes / decisions log

### 2026-09-30 — all phases implemented in one session (at the owner's request)

**Tooling**
- TypeScript pinned to 6.0 (ts-jest and typescript-eslint do not support TS 7 yet). Phaser pinned to 3.90 as specified.
- Workspace packages (`@maze/shared`, `@maze/simulation`) ship TS sources (`main: src/index.ts`); Next transpiles them,
  tsx runs them in dev, tsup bundles them into the server build, Jest maps them to `src`.
- Postgres without Docker: `npm run db:start` uses the `embedded-postgres` npm binaries. Server repository tests boot one
  automatically (or use `TEST_DATABASE_URL`, as CI does).
- Server falls back to an in-memory store when `DATABASE_URL` is unset or unreachable (dev only; production refuses).

**Protocol additions** (all in `packages/shared`)
- Error codes: `INVALID_PAYLOAD`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_IN_PROGRESS`, `ALREADY_IN_ROOM`, `NOT_HOST`,
  `CANNOT_SKIP`, `SPECTATOR`, `UNAUTHORIZED`.
- Events: `room:start` (host force-start), `room:spectate`, `chat:send` / `chat:message`; `GameEvent` gained
  `tower_target` and `ping`; `wave_started` carries `boss`.
- `TowerSnap.targetMode`; `Snapshot.buildTimeLeft` and `Snapshot.nextWave` (wave preview); `RoomState.difficulty`,
  `spectators`, `countdownEndsAt`.
- `serverTime` in snapshots is simulation time (`tick * 50 ms`); clients re-sync their clock offset after pauses.

**Game rules interpretation**
- Upgrades: +30% / +10% of *base* damage/range per level (additive), cost `round(base * 1.5^level)`.
- Support aura range scales with its level; supports do not buff other supports.
- Placement also rejects cells under a ground enemy (current cell or the cell it is walking to) and any placement that
  would leave a ground enemy with no path.
- Wave skip = only during the build phase, +1 gold per remaining whole second; not allowed right before a boss wave.
- Win = clearing wave 30. `wavesReached` = the wave in progress when the base fell.
- Abandoned games (everyone gone for 60 s, or last player leaves) are saved as a loss if at least one wave started.
- Usernames are unique case-insensitively (extra index `idx_users_username_lower`).

**Graphics / audio**
- Kenney assets replaced by procedural Canvas 2D art (`client/src/game/art.ts`), rendered at 64 px per tile (2x) for crisp
  scaling; no binary assets in the repo. Sounds are synthesized with WebAudio (`client/src/lib/audio.ts`).

**Measurements**
- Simulation perf test: 300 enemies + 40 towers, `update` well under the 5 ms budget. Coverage: 99% statements, 100% lines.
- Balance bot (`npm run balance -- --games 34`, meadow/normal, 102 games in 12.7 s), **no tuning needed**:

  | strategy | avg wave | min | max | wins |
  |---|---|---|---|---|
  | arrows-only | 19.8 | 18 | 20 | 0% |
  | mixed | **20.3** | 20 | 30 | 3% |
  | maze-heavy | 20.0 | 20 | 20 | 0% |

  mixed on easy: 30.0 (100% wins); on hard: 10.0 (dies at the first boss); canyon/normal: 30.0. The wave-20 boss
  (~4,900 HP, armor 8) is the main wall on normal — the first knob to turn if games feel too short.
- Snapshot bandwidth (Phase 9): full 540,311 bytes → delta 305,459 bytes over a 150 s game = **43.5% reduction**
  (towers only on change, enemy type/maxHp and projectile kind only on first sight, nextWave only on change).
- Load test (`tools/load-test.ts`, 25 rooms × 2 players, 45 s, MacBook Air): server avg tick **0.085 ms** (budget 10 ms),
  ~188 bytes per snapshot, 3.3 KiB/s per client.

### 2026-09-30 — Phase 11: versus replaces co-op (owner decision)

- Co-op felt like "one player with extra hands" (shared gold, shared maze). Replaced by **versus** (send-style, 2–4
  players, last castle standing) plus **solo**. Full rules in `09-VERSUS.md`.
- New `MatchSimulation` owns one `GameSimulation` per board; versus boards share the seed so base waves are identical.
  `GameSimulation` gained timed waves, income and an incoming-send queue. Still pure and deterministic (tested).
- Versus balance (first pass, untuned): 250 start gold, 20 lives, waves every 30 s, 10 base income;
  sends grunt 15g/+1, runner 20g/+1, flyer 40g/+3, tank 60g/+4.
- Snapshot bandwidth with multiple boards: 1,158,289 → 726,415 bytes over a 150 s 2-player game = **37.3% reduction**.
- Verified end to end with 3 browsers against Postgres: sends, watching an opponent's board, forfeits, placements,
  versus leaderboard; no console errors.
- Fixed: `npm run db:start` run while Postgres was already up used to stop the running server on exit
  (embedded-postgres cleanup). It now detects the open port and exits without touching it.
- Fixed: leaving from the game-over screen could bounce to /lobby instead of the chosen page.

### 2026-10-01 — Phase 12: gameplay depth

- Rules and numbers in `05-GAME-DESIGN.md` → "Phase 12 additions"; every item is listed in `FEATURES.md`.
- New towers were tuned with controlled bot swaps (replace one tower type in the proven "mixed" build):
  laser ≈ sniper, mines ≈ cannon, tesla slightly better than cannon (mostly because cannons can't hit flyers).
  Buffed laser 12→20 DPS and mines 60→90 every 3 s; tesla kept at 18 / 0.9.
- Balance bot now picks branches and perks and has a `--breakdown` flag (damage share per tower type).
  Results (meadow / normal, 34 games each): arrows-only 19.9, **mixed 24.1 (41% wins)**, maze-heavy 23.8,
  new-towers 22.9. Hard: mixed 12.0. Fortress 29.0, Crossroads 26.0.
- ⚠ With branches and perks the game is easier than the original target (mixed ≈ 20 on normal). Levers if it
  feels too easy: fewer perks (every 10 waves), stronger wave HP scaling, or cheaper branch bonuses. Left as is
  for the owner to decide.
- Upgrading to level 3 now needs `branch` (`BRANCH_REQUIRED` otherwise). `TowerSnap` gained `branch` and
  `invested`; `BoardState` gained `beams`, `mines`, `perks`, `perkOffer`; enemies may carry
  `shield/maxShield/stunned/burning`. New events: `zap`, `mine_exploded`, `enemy_split`, `boss_ability`,
  `perk_offered`, `perk_chosen`. New socket event `perk:choose`.

**Open items**
- Public deployment (needs a VPS/Fly/Render account and domain) — see `docs/DEPLOYMENT.md`.
- Docker images and the CI workflow are written but were not executed locally (no Docker daemon was running).
- Stretch not done: replays (`match_commands` table exists but is not written), bots, per-player gold.
