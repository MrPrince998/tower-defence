import type { Difficulty } from '../types';

export const GAME = {
  GRID_WIDTH: 20,
  GRID_HEIGHT: 14,
  TILE_SIZE: 32,
  MAX_MAP_WIDTH: 64,
  MAX_MAP_HEIGHT: 64,
  TICK_RATE: 20,
  DT: 1 / 20,
  SNAPSHOT_EVERY_TICKS: 2, // 10 Hz
  START_GOLD: 200,
  BASE_HP: 20,
  SELL_REFUND: 0.7,
  FIRST_BUILD_TIME_SEC: 30,
  BUILD_TIME_SEC: 10,
  MAX_PLAYERS: 4, // versus; solo rooms hold one player
  WIN_WAVE: 30, // surviving (clearing) this wave wins the game
  PROJECTILE_SPEED: 10, // tiles/s
  RETARGET_INTERVAL_SEC: 0.25,
  SPATIAL_CELL_SIZE: 2, // tiles
  WAVE_SKIP_BONUS_PER_SEC: 1, // gold per skipped build second
} as const;

export const ROOM = {
  CODE_LENGTH: 4,
  COUNTDOWN_SEC: 3,
  RECONNECT_GRACE_SEC: 60,
  PAUSED_DESTROY_SEC: 60,
  MAX_COMMANDS_PER_SEC: 10,
  MAX_SPECTATORS: 8,
} as const;

export interface DifficultyConfig {
  hpMult: number;
  startGold: number;
  baseHp: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { hpMult: 0.8, startGold: 300, baseHp: 30 },
  normal: { hpMult: 1.0, startGold: 200, baseHp: 20 },
  hard: { hpMult: 1.3, startGold: 150, baseHp: 10 },
};
