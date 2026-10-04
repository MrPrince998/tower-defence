# 03 — Protocol (Shared Types and Socket Events)

All of this lives in `packages/shared`. Client and server import the same definitions.

## Core types
```ts
export type Vec2 = { x: number; y: number };            // cell or world coords (tiles)
export type TowerType = 'arrow' | 'cannon' | 'frost' | 'sniper' | 'support';
export type EnemyType = 'grunt' | 'runner' | 'tank' | 'flyer' | 'boss';
export type TargetMode = 'first' | 'last' | 'strongest' | 'closest';
export type RoomStatus = 'lobby' | 'countdown' | 'running' | 'paused' | 'ended';

export interface TowerSnap { id: number; type: TowerType; x: number; y: number; level: number; owner: string; }
export interface EnemySnap { id: number; type: EnemyType; x: number; y: number; hp: number; maxHp: number; slowed: boolean; }
export interface ProjectileSnap { id: number; x: number; y: number; kind: TowerType; }

export interface Snapshot {
  tick: number;
  serverTime: number;        // ms
  wave: number;
  waveState: 'building' | 'spawning' | 'active';
  baseHp: number;
  gold: number;
  towers: TowerSnap[];       // may be sent only on change (delta) — see below
  enemies: EnemySnap[];
  projectiles: ProjectileSnap[];
}

export interface RoomPlayer { userId: string; name: string; ready: boolean; connected: boolean; }
export interface RoomState { roomId: string; code: string; status: RoomStatus; hostId: string; mapId: string; players: RoomPlayer[]; }

export type GameEvent =
  | { t: 'tower_built'; tower: TowerSnap }
  | { t: 'tower_upgraded'; id: number; level: number }
  | { t: 'tower_sold'; id: number; refund: number }
  | { t: 'enemy_killed'; id: number; x: number; y: number; reward: number }
  | { t: 'enemy_leaked'; id: number; damage: number }
  | { t: 'wave_started'; wave: number }
  | { t: 'wave_cleared'; wave: number; bonus: number }
  | { t: 'path_updated' };                  // clients redraw path overlay

export interface GameOverPayload { result: 'win' | 'lose'; wavesReached: number; durationSec: number; stats: PlayerStats[]; }
export interface PlayerStats { userId: string; kills: number; damageDealt: number; goldSpent: number; }

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; code: ErrorCode };
```

## Client → Server events (all with ack callback)
| Event | Payload | Notes |
|---|---|---|
| `room:create` | `{ mapId: string; difficulty: 'easy'\|'normal'\|'hard' }` | ack `{ roomId, code }` |
| `room:join` | `{ code: string }` | ack `{ roomId }` |
| `room:leave` | `{}` | |
| `room:ready` | `{ ready: boolean }` | game starts when all ready (host can force) |
| `room:reconnect` | `{ roomId: string }` | server replies with full state |
| `tower:place` | `{ type: TowerType; x: number; y: number }` | may fail `BLOCKS_PATH` |
| `tower:upgrade` | `{ towerId: number }` | |
| `tower:sell` | `{ towerId: number }` | refund 70% |
| `tower:setTarget` | `{ towerId: number; mode: TargetMode }` | |
| `wave:skip` | `{}` | start next wave early for bonus gold |
| `ping:mark` | `{ x: number; y: number }` | stretch |

## Server → Client events
| Event | Payload |
|---|---|
| `room:state` | `RoomState` |
| `game:start` | `{ map: MapData; seed: number; config: ClientConfig; snapshot: Snapshot }` |
| `game:snapshot` | `Snapshot` (10 Hz) |
| `game:event` | `GameEvent` |
| `game:over` | `GameOverPayload` |
| `error` | `{ code: ErrorCode; message: string }` |

## MapData
```ts
export interface MapData { id: string; width: number; height: number; cells: number[]; // 0=buildable,1=blocked(rock),2=spawn,3=goal
  spawns: Vec2[]; goal: Vec2; }
```

## Bandwidth rules
- Round positions to 2 decimals
- Send full `towers` only in `game:start` and when changed (use `game:event`); snapshots may omit towers
- Do not send `maxHp`/`type` repeatedly if the client already knows the enemy id (optimization for Phase 9)

## Validation
Every client → server payload has a Zod schema in `shared/src/schemas`. Reject unknown fields; check integer bounds for `x`, `y`.

## Rate limits
Max 10 commands/sec per socket. Exceeding returns `RATE_LIMITED`.
