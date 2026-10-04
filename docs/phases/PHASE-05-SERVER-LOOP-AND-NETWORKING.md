# Phase 5 — Server Loop and Networking

**Required reading:** `01-ARCHITECTURE.md`, `03-PROTOCOL.md`, `06-ALGORITHMS.md` (section 13)
**Goal:** Run one `GameSimulation` per room on the server at 20 Hz and sync clients via snapshots and events.

## Deliverables
- `GameLoop` (fixed timestep accumulator) and `RoomGame` wrapper linking Room ↔ Simulation
- Command handlers for `tower:place|upgrade|sell|setTarget`, `wave:skip` with Zod validation and acks
- Snapshot builder (10 Hz) and event forwarder
- `game:start` payload (map, seed, config, initial snapshot); `game:over` payload
- Per-socket rate limiter (10 cmds/s)
- Integration tests using `socket.io-client`

## Tasks
1. On countdown end, create simulation with map, difficulty, seed; start loop.
2. Queue commands per room; drain at the start of each tick (never mutate sim from socket callbacks directly).
3. Broadcast snapshots every 2nd tick; broadcast events immediately.
4. Stop loop and cleanup on `game:over` or when all players leave.
5. Pause after all players disconnected; destroy after 60 s.

## Acceptance criteria
- Two test clients receive identical events and consistent snapshots
- Invalid payloads are rejected with proper `ErrorCode` and don't crash the loop
- Loop drift test: 10 s of runtime = 200 ticks ±2
- Command from a player not in the room is rejected (`NOT_IN_ROOM`)

## Pitfalls
- Cap accumulator to avoid the spiral of death
- Don't `await` DB calls inside the tick

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-05-SERVER-LOOP-AND-NETWORKING.md with required reading. Phase 5 only.
