# Phase 9 — Polish and Reconnect

**Required reading:** `01-ARCHITECTURE.md` (room lifecycle), `03-PROTOCOL.md`
**Goal:** Production-feel: reconnection, effects, audio, spectators, bandwidth optimization.

## Deliverables
- Reconnect: client stores `roomId`; on reconnect emits `room:reconnect`; server sends full `game:start`-style state; player slot is reserved for 60 s
- Disconnect UI: "player disconnected" banner; game pauses only if everyone disconnects
- Effects: particles (explosions, frost, coin pop), tweens, screen shake on base damage, damage numbers
- Sound: shoot, hit, wave start, boss warning, with mute toggle
- Spectator mode: join a running room read-only (`room:spectate`)
- Snapshot delta/compression (omit unchanged towers; short field names optional)
- Chat and map pings (stretch)

## Tasks
1. Reconnect flow and tests (drop socket, rejoin, state consistent).
2. Add effect layer in Phaser driven by `game:event`.
3. Audio manager with volume settings persisted in localStorage.
4. Spectator role in `RoomManager` (no commands accepted).
5. Measure bytes/sec per client before and after optimization; record in tracker notes.

## Acceptance criteria
- Refreshing the page mid-game returns the player to the same state
- Spectator commands are rejected
- Snapshot bandwidth reduced by ≥ 30% vs Phase 5 baseline
- No console errors during a 10-wave run

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-09-POLISH-AND-RECONNECT.md with required reading. Phase 9 only.
