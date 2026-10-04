import type { EnemyType } from '../types';

export interface EnemyConfig {
  name: string;
  hp: number;
  speed: number; // tiles/s
  armor: number;
  reward: number;
  budgetCost: number; // wave generator cost (boss is special)
  leakDamage: number;
  flying: boolean;
  spawnIntervalSec: number;
  /** Shield absorbs damage before HP (scaled like HP). */
  shield?: number;
  /** Heals other enemies nearby: `pct` of their max HP every `everySec`. */
  heal?: { radius: number; pct: number; everySec: number };
  /** Splits into smaller enemies when killed. */
  split?: { into: EnemyType; count: number };
  /** Boss abilities: periodic summons, and a one-time enrage below a HP fraction. */
  summon?: { everySec: number; type: EnemyType; count: number };
  enrage?: { belowHpPct: number; shieldPct: number; speedMult: number };
}

export const ENEMIES: Record<EnemyType, EnemyConfig> = {
  grunt: {
    name: 'Grunt',
    hp: 40,
    speed: 1.5,
    armor: 0,
    reward: 5,
    budgetCost: 10,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.8,
  },
  runner: {
    name: 'Runner',
    hp: 25,
    speed: 3.0,
    armor: 0,
    reward: 4,
    budgetCost: 12,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.5,
  },
  tank: {
    name: 'Tank',
    hp: 200,
    speed: 0.9,
    armor: 5,
    reward: 15,
    budgetCost: 40,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.8,
  },
  flyer: {
    name: 'Flyer',
    hp: 50,
    speed: 2.0,
    armor: 0,
    reward: 8,
    budgetCost: 25,
    leakDamage: 1,
    flying: true,
    spawnIntervalSec: 0.8,
  },
  healer: {
    name: 'Healer',
    hp: 60,
    speed: 1.3,
    armor: 0,
    reward: 10,
    budgetCost: 22,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.8,
    heal: { radius: 1.8, pct: 0.06, everySec: 1 },
  },
  splitter: {
    name: 'Splitter',
    hp: 90,
    speed: 1.2,
    armor: 0,
    reward: 6,
    budgetCost: 24,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.9,
    split: { into: 'runner', count: 3 },
  },
  shielded: {
    name: 'Knight',
    hp: 80,
    speed: 1.1,
    armor: 2,
    reward: 9,
    budgetCost: 26,
    leakDamage: 1,
    flying: false,
    spawnIntervalSec: 0.8,
    shield: 70,
  },
  boss: {
    name: 'Boss',
    hp: 1500,
    speed: 0.8,
    armor: 8,
    reward: 150,
    budgetCost: 0,
    leakDamage: 10,
    flying: false,
    spawnIntervalSec: 0.8,
    summon: { everySec: 8, type: 'grunt', count: 2 },
    enrage: { belowHpPct: 0.5, shieldPct: 0.3, speedMult: 1.25 },
  },
};

export const ENEMY_SCALING = {
  HP_PER_WAVE: 0.12, // hp = baseHp * (1 + 0.12 * (wave - 1))
  SLOW_MULT: 0.6,
} as const;

export function waveHpScale(wave: number): number {
  return 1 + ENEMY_SCALING.HP_PER_WAVE * (wave - 1);
}

export function enemyHp(type: EnemyType, wave: number, hpMult: number): number {
  return Math.round(ENEMIES[type].hp * waveHpScale(wave) * hpMult);
}

export function enemyShield(type: EnemyType, wave: number, hpMult: number): number {
  return Math.round((ENEMIES[type].shield ?? 0) * waveHpScale(wave) * hpMult);
}
