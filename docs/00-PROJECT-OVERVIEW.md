# 00 — Project Overview

## Concept
Maze tower defense with two modes (co-op was replaced by versus on 2026-09-30, see `09-VERSUS.md`):

- **Versus (2–4 players):** every player defends their **own** copy of the map and castle against identical,
  timed waves. Players spend gold to **send extra enemies** at opponents; each send permanently raises the sender's
  income. Last castle standing wins.
- **Solo (1 player):** defend one castle for 30 waves. Score = waves survived, then time.

Enemies walk to the castle; towers block movement, so players **shape the enemy path (maze style)**.
If a castle's HP reaches 0, that player is out.

## MVP scope (must ship)
- Register/login (JWT), create/join room by code, ready-up
- One map (20x14 grid), 5 tower types, 4 enemy types + boss
- Server-authoritative simulation at 20 ticks/s
- Phaser client with interpolation and placement preview
- Waves 1..N with budget-based generator
- Save match results + leaderboard

## Stretch scope
- Multiple maps, difficulty modes, per-player gold, spectators, replays, chat/pings, bots, sound, tower targeting modes

## Non-goals
- Free-form (non-grid) movement, mobile-optimized controls, microservices, co-op (removed in favour of versus)

## Glossary
- **Cell**: one grid square. Coordinates `(x, y)`, origin top-left.
- **Flow field**: BFS distance map from the goal; enemies step to the lowest-cost neighbor.
- **Tick**: one fixed simulation step (`dt = 1/20 s`).
- **Snapshot**: compact state sent from server to clients (10 Hz).
- **Command**: client intent (e.g. `tower:place`) validated by the server.
- **Room**: one game session with 1-4 players.
