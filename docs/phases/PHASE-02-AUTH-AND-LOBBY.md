# Phase 2 — Auth and Lobby

**Required reading:** `03-PROTOCOL.md`, `04-DATABASE.md`, `02-CONVENTIONS.md`
**Goal:** Users register/login and can create, join, ready-up in rooms (reuse ideas from your Cows and Bulls project).

## Deliverables
- Migration runner + migrations for `users`, `maps` (seed one map)
- REST: `POST /auth/register`, `POST /auth/login`, `GET /me` (JWT bearer)
- Socket auth middleware (JWT in `handshake.auth.token`)
- `RoomManager`: create/join/leave/ready, 4-letter room codes, host transfer, status machine
- Client: login/register pages, lobby page (create/join by code), room screen with player list and ready toggle
- Zustand stores: `authStore`, `lobbyStore`

## Tasks
1. Zod-validated register/login, bcrypt hashing, JWT signing.
2. `RoomManager` in memory: `Map<roomId, Room>` and `Map<code, roomId>`; max 4 players; unique codes.
3. Handle events `room:create|join|leave|ready`; broadcast `room:state` to room members.
4. When all players ready → status `countdown` (3 s) → emit `game:start` placeholder.
5. Handle disconnect: mark `connected=false`, remove from lobby if not started.

## Acceptance criteria
- Two browser tabs (two users) can create/join the same room and both see ready state live
- Invalid JWT rejects socket connection
- Unit tests for `RoomManager` (full room, duplicate join, host transfer, leave)

## Pitfalls
- Never trust `userId` from the client; take it from the verified token
- Clean up empty rooms to avoid memory leaks

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-02-AUTH-AND-LOBBY.md with required reading. Implement Phase 2 only.
