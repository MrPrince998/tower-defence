# 01 — Architecture

## Monorepo layout (npm workspaces)
```
maze-defense/
├── CLAUDE.md
├── docs/
├── packages/
│   ├── shared/            # types, zod schemas, config (towers, enemies, waves)
│   │   └── src/{types,events,schemas,config}/
│   ├── simulation/        # PURE game logic, no I/O
│   │   └── src/{GameSimulation.ts,grid/,flowField.ts,entities/,systems/,rng.ts}
│   ├── server/            # Express + Socket.io + Postgres
│   │   └── src/{index.ts,http/,sockets/,rooms/,db/,auth/,loop/}
│   └── client/            # Next.js + Phaser
│       └── src/{app/,game/,components/,stores/,lib/}
├── docker-compose.yml
└── package.json
```
Dependency direction: `client → shared`, `server → simulation → shared`. `simulation` must never import server/client code.

## Layers
```
Browser (React UI + Phaser)  <-- Socket.io -->  Server sockets  -->  RoomManager  -->  GameSimulation (pure)
        |                                              |                                     |
   Zustand store                                 Express REST                        Postgres (on match end)
```

## Authority model
- Client sends **commands** (intent). Server validates, applies to simulation, broadcasts results.
- Client never computes damage, kills, gold, or path validity (it may preview placement locally for UX only; the server decides).

## Server tick loop
```
fixed timestep 50 ms (20 Hz), accumulator pattern
every tick:   sim.update(dt) -> drain queued commands first, then systems
every 2 ticks: build snapshot -> io.to(roomId).emit('game:snapshot', snap)
on events:    io.to(roomId).emit('game:event', evt)   // built, killed, wave cleared
```
System order inside `update`: commands → wave spawner → enemy movement → tower targeting/firing → projectiles → status effects → deaths/rewards → base damage → win/lose check.

## Room lifecycle
`LOBBY → COUNTDOWN → RUNNING → (PAUSED on all disconnected, 60s) → ENDED → persisted → destroyed`

## State ownership
- Room state (players, ready flags): `RoomManager` (in memory).
- Game state: `GameSimulation` instance per room (in memory).
- Durable data: Postgres (users, matches, stats). Written only at match end.
- Client UI state: Zustand (lobby, HUD, selected tower). Game entities live in Phaser scene, fed by snapshots.
