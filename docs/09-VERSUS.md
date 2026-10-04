# 09 — Versus and Solo Modes

Decided 2026-09-30: co-op (shared map, shared gold) is replaced by **versus** ("send" tower defense) plus **solo**.
Numbers live in `packages/shared/src/config/versus.ts`; logic reads config, never inlines numbers.

## Rules

| | Solo | Versus |
|---|---|---|
| Players per room | 1 (starts immediately) | 2–4 (all ready, or host force-start with 2+) |
| Boards | 1 | one per player, same map, **same seed** (identical base waves) |
| Difficulty | easy / normal / hard | always normal enemy HP |
| Start gold / castle HP | per difficulty | 250 / 20 |
| Waves | 30 s build, then next build phase after each clear (skippable) | 30 s build, then a wave **every 30 s** whether cleared or not |
| Income | — | 10 gold at every wave start, + income from sends |
| Clear bonus | 20 + 2w | 20 + 2w, once per wave, if the board is empty before the next wave |
| End | castle falls (lose) or wave 30 cleared (win) | castle falls → knocked out; last standing is 1st |

## Sending enemies

`send:enemy { type, target? }` — allowed once wave 1 has started, for players still alive.

| Unit | Cost | Income gained |
|---|---|---|
| grunt | 15 | +1 |
| runner | 20 | +1 |
| flyer | 40 | +3 |
| tank | 60 | +4 |
| healer | 45 | +3 |
| splitter | 50 | +3 |
| shielded (Knight) | 55 | +4 |

- Default target: the next alive player after you in seat order. Explicit targets must be alive opponents.
- Sent units spawn on the target board one by one (0.35 s apart, round-robin over spawns) with HP scaled to that
  board's current wave. The defender earns the normal kill reward.
- A board can have at most 40 incoming units queued (`SEND_QUEUE_FULL`).

## Placement and elimination

- Knock-outs in the same tick share a place. If the last players fall together, they share 1st.
- Leaving or not reconnecting within 60 s forfeits: the board is knocked out, the others play on.
- Eliminated boards stop simulating but stay visible to everyone.

## Protocol changes (see `03-PROTOCOL.md`)

- `room:create` takes `mode: 'solo' | 'versus'`; `RoomState.mode`.
- `Snapshot = { tick, serverTime, mode, boards: BoardSnapshot[] }`; `BoardSnapshot` carries `id, alive, placement,
  wave, waveState, nextWaveIn, baseHp, gold, income, towers?, enemies, projectiles, nextWave?`.
- `game:event` payload is `MatchEvent = { board, event }`. New events: `enemy_sent`, `player_eliminated`.
- `GameOverPayload` gains `mode` and `winners`; `PlayerStats` gains `enemiesSent`, `placement`.
- `ping:mark` removed.

## Persistence

Migration `003_versus.sql`: `matches.mode`, `match_players.placement`, `match_players.enemies_sent`.
Solo leaderboard = solo matches only. Versus ranking = wins (placement 1) DESC, then fewer games.

## Client

- Main view shows one board (yours by default). Opponents appear as live mini-boards; click one (or Tab) to watch it,
  Home to return. Building is only possible on your own live board; sends work from any view.
- Hotkeys: 1–9 towers, Z X C V B N M send grunt/runner/tank/flyer/healer/splitter/knight, U upgrade, S sell, Esc cancel, Space (solo) start wave.
