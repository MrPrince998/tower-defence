import { ENEMIES, isBossWave, WAVES, waveBudget, type EnemyType, type WavePreview } from '@maze/shared';
import type { Rng } from '../rng';

type NormalType = Exclude<EnemyType, 'boss'>;
const NORMAL_TYPES = Object.keys(WAVES.UNLOCK_WAVE) as NormalType[];

export function unlockedTypes(wave: number): NormalType[] {
  return NORMAL_TYPES.filter((t) => wave >= WAVES.UNLOCK_WAVE[t]);
}

/** Budget-based wave list (05-GAME-DESIGN.md). Boss waves: 30% budget of escorts, then one boss. */
export function generateWave(wave: number, rng: Rng): EnemyType[] {
  const boss = isBossWave(wave);
  let budget = waveBudget(wave) * (boss ? WAVES.BOSS_BUDGET_FRACTION : 1);
  const unlocked = unlockedTypes(wave);
  const minCost = Math.min(...unlocked.map((t) => ENEMIES[t].budgetCost));
  const list: EnemyType[] = [];
  while (budget >= minCost) {
    const affordable = unlocked.filter((t) => ENEMIES[t].budgetCost <= budget);
    const pick = rng.weighted(affordable, (t) => WAVES.WEIGHTS[t]);
    budget -= ENEMIES[pick].budgetCost;
    list.push(pick);
  }
  if (boss) list.push('boss');
  return list;
}

export function waveCost(list: readonly EnemyType[]): number {
  return list.reduce((sum, t) => sum + ENEMIES[t].budgetCost, 0);
}

export function previewOf(wave: number, list: readonly EnemyType[]): WavePreview {
  const counts: WavePreview['counts'] = {};
  for (const t of list) counts[t] = (counts[t] ?? 0) + 1;
  return { wave, boss: isBossWave(wave), counts };
}
