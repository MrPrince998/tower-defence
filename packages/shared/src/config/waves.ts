import type { EnemyType } from '../types';

export const WAVES = {
  BUDGET_BASE: 20,
  BUDGET_PER_WAVE: 12,
  BUDGET_EXPONENT: 1.5,
  UNLOCK_WAVE: { grunt: 1, runner: 3, tank: 5, flyer: 7, healer: 8, splitter: 11, shielded: 13 } as Record<
    Exclude<EnemyType, 'boss'>,
    number
  >,
  WEIGHTS: { grunt: 4, runner: 3, tank: 2, flyer: 2, healer: 1.5, splitter: 2, shielded: 2 } as Record<
    Exclude<EnemyType, 'boss'>,
    number
  >,
  BOSS_EVERY: 10,
  BOSS_BUDGET_FRACTION: 0.3,
  CLEAR_BONUS_BASE: 20,
  CLEAR_BONUS_PER_WAVE: 2,
} as const;

export function waveBudget(wave: number): number {
  return WAVES.BUDGET_BASE + WAVES.BUDGET_PER_WAVE * wave + Math.pow(wave, WAVES.BUDGET_EXPONENT);
}

export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % WAVES.BOSS_EVERY === 0;
}

export function waveClearBonus(wave: number): number {
  return WAVES.CLEAR_BONUS_BASE + WAVES.CLEAR_BONUS_PER_WAVE * wave;
}
