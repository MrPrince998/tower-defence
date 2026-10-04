import type {
  DifficultyConfig,
  EnemyType,
  GameEvent,
  MapData,
  Mods,
  PerkId,
  PlayerStats,
  WaveState,
} from '@maze/shared';
import type { Enemy, Mine, Projectile, Tower } from './entities';
import type { Grid } from './grid/Grid';
import type { Rng } from './rng';
import type { SpatialHash } from './systems/SpatialHash';

export interface SpawnEntry {
  type: EnemyType;
  spawnIndex: number;
}

export type WaveMode = 'clear' | 'timed';

export interface WaveRuntime {
  enabled: boolean;
  /** clear: next build phase starts once the wave is cleared (solo). timed: waves every `interval` s (versus). */
  mode: WaveMode;
  interval: number;
  clearedWave: number; // last wave whose clear bonus was paid (timed mode)
  wave: number; // current (or last started) wave; 0 before the first
  state: WaveState;
  buildTimer: number; // seconds until the next wave (build phase, or the interval in timed mode)
  queue: SpawnEntry[];
  spawnTimer: number;
  nextList: EnemyType[]; // pre-generated list for wave + 1 (drives the preview)
}

/** Mutable state shared by all systems of one simulation. */
export interface World {
  map: MapData;
  grid: Grid;
  rng: Rng;
  dt: number;
  tick: number;
  gold: number;
  baseHp: number;
  difficulty: DifficultyConfig;
  enemies: Enemy[];
  towers: Map<number, Tower>;
  projectiles: Projectile[];
  hash: SpatialHash;
  events: GameEvent[];
  stats: Map<string, PlayerStats>;
  ids: { enemy: number; tower: number; projectile: number; mine: number };
  mines: Mine[];
  /** Laser beams this tick, flat [towerId, enemyId, ...]. */
  beams: number[];
  perks: PerkId[];
  perkOffers: PerkId[][];
  mods: Mods;
  /** Cells on the current enemy paths (for mine placement), cached per grid version. */
  pathCache: { version: number; cells: { x: number; y: number }[] };
  auraDirty: boolean;
  income: number; // paid at every wave start
  sends: { queue: EnemyType[]; timer: number; spawnIndex: number; interval: number };
  result: 'win' | 'lose' | null;
  waves: WaveRuntime;
}

export function statsFor(world: World, userId: string): PlayerStats {
  let s = world.stats.get(userId);
  if (!s) {
    s = { userId, kills: 0, damageDealt: 0, goldSpent: 0, towersBuilt: 0, enemiesSent: 0, placement: null };
    world.stats.set(userId, s);
  }
  return s;
}
