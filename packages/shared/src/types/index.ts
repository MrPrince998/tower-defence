export type Vec2 = { x: number; y: number }; // cell or world coords (tiles)

export const TOWER_TYPES = [
  'arrow',
  'cannon',
  'frost',
  'sniper',
  'support',
  'laser',
  'tesla',
  'mines',
  'barricade',
] as const;
export const ENEMY_TYPES = [
  'grunt',
  'runner',
  'tank',
  'flyer',
  'healer',
  'splitter',
  'shielded',
  'boss',
] as const;
export const TOWER_BRANCHES = ['a', 'b'] as const;
export const PERK_IDS = [
  'sharpened',
  'eagle_eye',
  'rapid_reload',
  'masonry',
  'bounty',
  'frostbite',
  'interest',
  'war_chest',
  'fortify',
] as const;
export const TARGET_MODES = ['first', 'last', 'strongest', 'closest'] as const;
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export const GAME_MODES = ['solo', 'versus'] as const;
/** Enemy types a player can send at an opponent in versus mode. */
export const SEND_TYPES = ['grunt', 'runner', 'tank', 'flyer', 'healer', 'splitter', 'shielded'] as const;

export type TowerType = (typeof TOWER_TYPES)[number];
export type EnemyType = (typeof ENEMY_TYPES)[number];
export type TargetMode = (typeof TARGET_MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type SendType = (typeof SEND_TYPES)[number];
export type TowerBranch = (typeof TOWER_BRANCHES)[number];
export type PerkId = (typeof PERK_IDS)[number];
export type RoomStatus = 'lobby' | 'countdown' | 'running' | 'paused' | 'ended';
export type WaveState = 'building' | 'spawning' | 'active';

export type ErrorCode =
  | 'NOT_IN_ROOM'
  | 'NOT_ENOUGH_GOLD'
  | 'INVALID_CELL'
  | 'BLOCKS_PATH'
  | 'CELL_OCCUPIED'
  | 'TOWER_NOT_FOUND'
  | 'MAX_LEVEL'
  | 'GAME_NOT_RUNNING'
  | 'RATE_LIMITED'
  // Additions beyond 02-CONVENTIONS.md, needed by lobby/auth flows.
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'ALREADY_IN_ROOM'
  | 'NOT_HOST'
  | 'CANNOT_SKIP'
  | 'SPECTATOR'
  | 'UNAUTHORIZED'
  // Versus mode
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_TARGET'
  | 'SEND_QUEUE_FULL'
  | 'NOT_AVAILABLE'
  | 'ELIMINATED'
  // Phase 12
  | 'BRANCH_REQUIRED'
  | 'NO_PERK_OFFER'
  | 'INVALID_PERK';

export interface TowerSnap {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  level: number;
  owner: string;
  targetMode: TargetMode;
  branch: TowerBranch | null;
  invested: number; // gold actually spent (after perk discounts); sell refund = 70% of this
}

/**
 * `type`, `maxHp` and `slowed` are always present in full snapshots (game:start, reconnect).
 * Broadcast snapshots omit `type`/`maxHp` for enemies the client already knows and omit `slowed` when false.
 */
export interface EnemySnap {
  id: number;
  type?: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp?: number;
  slowed?: boolean;
  /** Only for enemies with a shield (knights, enraged bosses); sent whenever the enemy has one. */
  shield?: number;
  maxShield?: number;
  stunned?: boolean;
  burning?: boolean;
}

/** `kind` is omitted in broadcast snapshots after the projectile's first appearance. */
export interface ProjectileSnap {
  id: number;
  x: number;
  y: number;
  kind?: TowerType;
}

export interface WavePreview {
  wave: number;
  boss: boolean;
  counts: Partial<Record<EnemyType, number>>;
}

/** State of one player's board (solo: the only board; versus: one per player). */
export interface BoardState {
  wave: number;
  waveState: WaveState;
  /** Seconds until the next wave starts (solo: only during the build phase; versus: always). */
  nextWaveIn: number;
  baseHp: number;
  gold: number;
  income: number; // gold paid at every wave start (versus)
  towers?: TowerSnap[]; // omitted in broadcast snapshots unless towers changed
  enemies: EnemySnap[];
  projectiles: ProjectileSnap[];
  nextWave?: WavePreview | null; // omitted in broadcast snapshots when unchanged
  /** Active laser beams as flat pairs [towerId, enemyId, ...]. */
  beams: number[];
  /** Armed mines as flat pairs of cell-center coordinates [x, y, ...]. */
  mines: number[];
  perks: PerkId[];
  /** Perks to choose from (first pending offer), or null. */
  perkOffer: PerkId[] | null;
}

export interface BoardSnapshot extends BoardState {
  id: string; // owner userId
  alive: boolean;
  placement: number | null; // versus: final place once eliminated (1 = winner)
}

export interface Snapshot {
  tick: number;
  serverTime: number; // ms of simulation time
  mode: GameMode;
  boards: BoardSnapshot[];
}

export interface RoomPlayer {
  userId: string;
  name: string;
  ready: boolean;
  connected: boolean;
}

export interface RoomSpectator {
  userId: string;
  name: string;
}

export interface RoomState {
  roomId: string;
  code: string;
  status: RoomStatus;
  hostId: string;
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  countdownEndsAt?: number;
}

export type GameEvent =
  | { t: 'tower_built'; tower: TowerSnap }
  | { t: 'tower_upgraded'; id: number; level: number; branch: TowerBranch | null }
  | { t: 'tower_sold'; id: number; refund: number }
  | { t: 'tower_target'; id: number; mode: TargetMode }
  | { t: 'enemy_killed'; id: number; x: number; y: number; reward: number }
  | { t: 'enemy_leaked'; id: number; damage: number }
  | { t: 'wave_started'; wave: number; boss: boolean }
  | { t: 'wave_cleared'; wave: number; bonus: number }
  | { t: 'path_updated' }
  | { t: 'zap'; points: number[] } // tesla chain: flat [x, y, ...] from the tower through each enemy hit
  | { t: 'mine_exploded'; x: number; y: number; radius: number }
  | { t: 'enemy_split'; x: number; y: number; count: number }
  | { t: 'boss_ability'; id: number; ability: 'summon' | 'enrage'; x: number; y: number }
  | { t: 'perk_offered'; options: PerkId[] }
  | { t: 'perk_chosen'; perk: PerkId }
  // versus
  | { t: 'enemy_sent'; from: string; to: string; type: SendType; income: number }
  | { t: 'player_eliminated'; userId: string; placement: number };

/** Every event is tagged with the board it happened on (match-wide events use the affected player's board). */
export interface MatchEvent {
  board: string;
  event: GameEvent;
}

export interface PlayerStats {
  userId: string;
  kills: number;
  damageDealt: number;
  goldSpent: number;
  towersBuilt: number;
  enemiesSent: number;
  placement: number | null; // versus only
}

export interface GameOverPayload {
  mode: GameMode;
  /** Solo: whether wave 30 was cleared. Versus: always 'win' (see `winners`). */
  result: 'win' | 'lose';
  winners: string[]; // versus: userIds in 1st place (several on a simultaneous knock-out)
  wavesReached: number;
  durationSec: number;
  stats: PlayerStats[];
}

export interface MapData {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: number[]; // 0=buildable, 1=blocked(rock), 2=spawn, 3=goal
  spawns: Vec2[];
  goal: Vec2;
}

export const CELL = { BUILDABLE: 0, ROCK: 1, SPAWN: 2, GOAL: 3 } as const;

export interface ClientConfig {
  mode: GameMode;
  difficulty: Difficulty;
  tickRate: number;
  snapshotRate: number;
  tileSize: number;
  role: 'player' | 'spectator';
}

export interface GameStartPayload {
  map: MapData;
  seed: number;
  config: ClientConfig;
  snapshot: Snapshot;
  players: RoomPlayer[];
}

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  at: number;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; code: ErrorCode };
export type CommandResult = { ok: true } | { ok: false; code: ErrorCode };

/** Commands accepted by the simulation (already validated at the network edge). */
export type GameCommand =
  | { kind: 'place'; type: TowerType; x: number; y: number }
  | { kind: 'upgrade'; towerId: number; branch?: TowerBranch }
  | { kind: 'sell'; towerId: number }
  | { kind: 'setTarget'; towerId: number; mode: TargetMode }
  | { kind: 'skipWave' }
  | { kind: 'choosePerk'; perk: PerkId }
  | { kind: 'send'; type: SendType; target?: string };

export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

// ---------------------------------------------------------------- REST DTOs

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface LeaderboardEntry {
  id: string;
  wavesReached: number;
  durationSec: number;
  result: 'win' | 'lose';
  endedAt: string;
  players: string[];
}

/** Versus ranking: players ordered by wins, then by fewer games. */
export interface VersusLeaderboardEntry {
  userId: string;
  username: string;
  wins: number;
  games: number;
  enemiesSent: number;
}

export interface ProfileStats {
  user: { id: string; username: string; createdAt: string };
  games: number; // solo
  wins: number; // solo (cleared wave 30)
  kills: number;
  damageDealt: number;
  bestWave: number; // solo
  versusGames: number;
  versusWins: number;
}

export interface MatchHistoryEntry {
  id: string;
  mode: GameMode;
  placement: number | null;
  enemiesSent: number;
  mapId: string;
  difficulty: Difficulty;
  result: 'win' | 'lose';
  wavesReached: number;
  durationSec: number;
  endedAt: string;
  kills: number;
  damageDealt: number;
  goldSpent: number;
  towersBuilt: number;
  players: string[];
}

export interface HealthResponse {
  status: 'ok';
  uptimeSec: number;
  rooms: number;
  players: number;
  avgTickMs: number;
  db: 'postgres' | 'memory';
}
