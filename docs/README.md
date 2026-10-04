# Co-op Maze Defense — Documentation Index

Multiplayer co-op tower defense. Players place towers on a grid to shape (maze) the enemy path to a shared base.
Stack: Node.js + Express + Socket.io + PostgreSQL (backend), Next.js + React + Phaser 3 + Zustand (frontend), TypeScript everywhere.

## Reading order for AI
| File | Purpose | Read when |
|---|---|---|
| `00-PROJECT-OVERVIEW.md` | Goals, scope, glossary | Always first |
| `01-ARCHITECTURE.md` | Monorepo layout, data flow, tick loop | Any structural work |
| `02-CONVENTIONS.md` | Code style, testing, env, git | Any coding |
| `03-PROTOCOL.md` | Shared types, socket events, payloads | Networking, client, server |
| `04-DATABASE.md` | Postgres schema, queries | Persistence, auth, leaderboard |
| `05-GAME-DESIGN.md` | Towers, enemies, economy, waves, numbers | Simulation, balance |
| `06-ALGORITHMS.md` | Flow field, validation, spatial hash, etc. | Simulation core |
| `07-AI-PROMPTING-GUIDE.md` | How to prompt per phase | Human reference |
| `08-PROGRESS-TRACKER.md` | Checklist of all phases | Start/end of every session |
| `FEATURES.md` | Every completed feature, in one place | After finishing any feature |
| `09-VERSUS.md` | Versus ("send") and solo modes; replaces co-op | Anything touching modes, sends, boards |
| `phases/PHASE-XX-*.md` | Step-by-step build plan | Current phase only |

## Phase list
1. `PHASE-01-PROJECT-SETUP.md`
2. `PHASE-02-AUTH-AND-LOBBY.md`
3. `PHASE-03-SIMULATION-CORE.md`
4. `PHASE-04-TOWERS-AND-COMBAT.md`
5. `PHASE-05-SERVER-LOOP-AND-NETWORKING.md`
6. `PHASE-06-PHASER-CLIENT.md`
7. `PHASE-07-WAVES-AND-BALANCE.md`
8. `PHASE-08-PERSISTENCE-AND-LEADERBOARD.md`
9. `PHASE-09-POLISH-AND-RECONNECT.md`
10. `PHASE-10-TESTING-AND-DEPLOY.md`
