# Phase 8 — Persistence and Leaderboard

**Required reading:** `04-DATABASE.md`, `03-PROTOCOL.md` (GameOverPayload)
**Goal:** Save finished matches and show leaderboard, profile, and history.

## Deliverables
- Migrations for `matches`, `match_players`, (optional) `match_commands`
- `MatchRepository.saveMatch()` in a single transaction, called on `game:over`
- Simulation tracks per-player stats (kills, damage, gold spent, towers built)
- REST: `GET /leaderboard?mapId&difficulty`, `GET /users/:id/profile`, `GET /me/matches`
- Client pages: `/leaderboard`, `/profile`, `/history`, and a game-over summary screen

## Tasks
1. Add stat attribution (who placed the tower gets credit for its kills/damage).
2. Save on end; failure to save must not crash the room (log and retry once).
3. Implement queries and pagination (limit/offset or cursor).
4. Build UI tables and the summary screen.

## Acceptance criteria
- Finishing a game creates one `matches` row and one `match_players` row per player
- Leaderboard order: waves DESC, duration ASC
- Repository tests run against a real Postgres (docker) and pass
- SQL uses parameters only

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-08-PERSISTENCE-AND-LEADERBOARD.md with required reading. Phase 8 only.
