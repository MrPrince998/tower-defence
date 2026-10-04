# Phase 6 — Phaser Client

**Required reading:** `03-PROTOCOL.md`, `06-ALGORITHMS.md` (sections 11-12), `05-GAME-DESIGN.md` (grid, towers)
**Goal:** A playable client: render map, towers, enemies, projectiles; place/upgrade/sell towers; smooth movement.

## Deliverables
- `GameCanvas` React component loading Phaser via `next/dynamic` (`ssr: false`)
- `GameScene`: tilemap from `MapData`, sprite pools for entities, health bars, range circles
- `SnapshotBuffer` + interpolation (render 100 ms in the past)
- Placement ghost (green valid / red invalid) using the shared `computeFlowField`
- HUD (React overlay): gold, wave, base HP, tower shop, selected tower panel (upgrade/sell/target mode), wave skip button
- Bridge between React and Phaser through a small event emitter or Zustand `gameStore`
- Assets from Kenney.nl tower defense pack in `client/public/assets`

## Tasks
1. Load assets in `PreloadScene`; build map layers.
2. Consume `game:start`, `game:snapshot`, `game:event` from the socket into `gameStore`/scene.
3. Interpolate entities; create/destroy sprites when ids appear/disappear.
4. Mouse hover → ghost; click → emit `tower:place`; handle ack errors with toast.
5. Tower selection → range circle + panel; upgrade/sell emit events.
6. Show path overlay (arrows or tinted cells) refreshed on `path_updated`.
7. Handle window resize (scale mode `FIT`).

## Acceptance criteria
- Movement looks smooth at 10 Hz snapshots (no visible jitter)
- Ghost turns red when placement would block the path or gold is insufficient
- Two browsers see the same towers/enemies with < 150 ms visual difference
- Sprite counts stay stable (no leaks) after 10 waves

## Pitfalls
- Phaser import on the server breaks SSR; keep it in client-only modules
- Don't put game logic in the scene; it renders state only
- Destroy the Phaser game instance on component unmount

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-06-PHASER-CLIENT.md with required reading. Phase 6 only.
