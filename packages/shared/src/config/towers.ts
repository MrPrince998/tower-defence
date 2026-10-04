import type { TargetMode, TowerBranch, TowerType } from '../types';
import { GAME } from './game';
import { NO_MODS, type Mods } from './perks';

/**
 * How a tower attacks:
 * - projectile: fires homing projectiles (arrow, cannon, frost, sniper)
 * - beam: continuous damage that ramps up while it stays on one target (laser)
 * - chain: instant lightning that jumps between nearby enemies (tesla)
 * - mines: lays mines on path cells in range; ground enemies set them off (mines)
 * - aura: buffs nearby towers, never attacks (support)
 * - wall: blocks the path only (barricade)
 */
export type TowerKind = 'projectile' | 'beam' | 'chain' | 'mines' | 'aura' | 'wall';

/** Level-3 specialisation. All fields are optional multipliers/flags on top of the base tower. */
export interface BranchConfig {
  name: string;
  description: string;
  damageMult?: number;
  rateMult?: number;
  rangeMult?: number;
  splashMult?: number;
  ignoreArmor?: boolean;
  /** Replaces the frost speed multiplier (lower = stronger slow). */
  slowMult?: number;
  /** Frost: the slow also hits every enemy within this radius of the target. */
  splashSlowRadius?: number;
  /** Damage over time applied to every enemy hit: pct of the hit's damage per second. */
  burn?: { pctPerSec: number; durationSec: number };
  crit?: { chance: number; mult: number };
  extraJumps?: number; // tesla
  stun?: { chance: number; durationSec: number }; // tesla
  rampMult?: number; // laser: ramp speed and cap multiplier
  extraTargets?: number; // laser: additional beams
  auraDamageMult?: number; // support: replaces the aura damage bonus
  goldPerWave?: number; // support: gold at every wave start
  mineDamageMult?: number;
  mineRadiusMult?: number;
  layRateMult?: number;
  extraMines?: number;
}

export interface TowerConfig {
  name: string;
  description: string;
  kind: TowerKind;
  cost: number;
  damage: number; // per hit (beam: per second)
  range: number; // tiles
  rate: number; // shots per second (0 = never fires)
  maxLevel: number;
  splashRadius?: number; // tiles
  groundOnly?: boolean;
  slow?: { mult: number; durationSec: number };
  aura?: { damageMult: number; rangeMult: number };
  beam?: { rampPerSec: number; maxRamp: number };
  chain?: { jumps: number; jumpRange: number; falloff: number };
  mines?: { layEverySec: number; maxMines: number; radius: number };
  branches?: { a: BranchConfig; b: BranchConfig };
  defaultTarget: TargetMode;
}

export const TOWERS: Record<TowerType, TowerConfig> = {
  arrow: {
    name: 'Arrow',
    description: 'Fast single-target shots.',
    kind: 'projectile',
    cost: 50,
    damage: 8,
    range: 3.5,
    rate: 3.0,
    maxLevel: 4,
    defaultTarget: 'first',
    branches: {
      a: { name: 'Rapid Fire', description: '+60% fire rate.', rateMult: 1.6 },
      b: { name: 'Piercing', description: 'Ignores armor, +20% damage.', ignoreArmor: true, damageMult: 1.2 },
    },
  },
  cannon: {
    name: 'Cannon',
    description: 'Splash damage. Cannot hit flyers.',
    kind: 'projectile',
    cost: 100,
    damage: 25,
    range: 3.0,
    rate: 0.8,
    maxLevel: 4,
    splashRadius: 1.2,
    groundOnly: true,
    defaultTarget: 'first',
    branches: {
      a: {
        name: 'Big Blast',
        description: '+50% blast radius, +15% damage.',
        splashMult: 1.5,
        damageMult: 1.15,
      },
      b: {
        name: 'Napalm',
        description: 'Sets victims on fire (30%/s for 3s).',
        burn: { pctPerSec: 0.3, durationSec: 3 },
      },
    },
  },
  frost: {
    name: 'Frost',
    description: 'Slows enemies by 40% for 2s.',
    kind: 'projectile',
    cost: 75,
    damage: 2,
    range: 3.0,
    rate: 1.5,
    maxLevel: 4,
    slow: { mult: 0.6, durationSec: 2 },
    defaultTarget: 'first',
    branches: {
      a: { name: 'Deep Freeze', description: 'Slows by 60% instead of 40%.', slowMult: 0.4 },
      b: {
        name: 'Shatter',
        description: 'The slow spreads to enemies near the target.',
        splashSlowRadius: 1.2,
      },
    },
  },
  sniper: {
    name: 'Sniper',
    description: 'Huge damage, long range, slow reload.',
    kind: 'projectile',
    cost: 150,
    damage: 80,
    range: 7.0,
    rate: 0.4,
    maxLevel: 4,
    defaultTarget: 'strongest',
    branches: {
      a: {
        name: 'Assassin',
        description: '25% chance to deal triple damage.',
        crit: { chance: 0.25, mult: 3 },
      },
      b: { name: 'Marksman', description: '+40% range, +30% fire rate.', rangeMult: 1.4, rateMult: 1.3 },
    },
  },
  support: {
    name: 'Support',
    description: '+20% damage, +10% range to nearby towers.',
    kind: 'aura',
    cost: 120,
    damage: 0,
    range: 2.0,
    rate: 0,
    maxLevel: 4,
    aura: { damageMult: 1.2, rangeMult: 1.1 },
    defaultTarget: 'first',
    branches: {
      a: { name: 'War Drums', description: 'Aura gives +35% damage.', auraDamageMult: 1.35 },
      b: { name: 'Gold Mine', description: '+15 gold every wave.', goldPerWave: 15 },
    },
  },
  laser: {
    name: 'Laser',
    description: 'Beam that burns hotter the longer it holds a target.',
    kind: 'beam',
    cost: 130,
    damage: 20, // per second at ramp 1
    range: 3.0,
    rate: 0,
    maxLevel: 4,
    beam: { rampPerSec: 0.6, maxRamp: 4 },
    defaultTarget: 'strongest',
    branches: {
      a: { name: 'Overcharge', description: 'Ramps twice as fast and twice as high.', rampMult: 2 },
      b: { name: 'Split Beam', description: 'Fires a second beam at another target.', extraTargets: 1 },
    },
  },
  tesla: {
    name: 'Tesla',
    description: 'Lightning that chains to 3 more enemies.',
    kind: 'chain',
    cost: 140,
    damage: 18,
    range: 2.6,
    rate: 0.9,
    maxLevel: 4,
    chain: { jumps: 3, jumpRange: 1.6, falloff: 0.75 },
    defaultTarget: 'first',
    branches: {
      a: {
        name: 'Storm',
        description: 'Chains to 2 more enemies, +10% damage.',
        extraJumps: 2,
        damageMult: 1.1,
      },
      b: {
        name: 'Paralyze',
        description: '30% chance to stun each enemy hit.',
        stun: { chance: 0.3, durationSec: 0.7 },
      },
    },
  },
  mines: {
    name: 'Mine Layer',
    description: 'Drops mines on the path. Ground only.',
    kind: 'mines',
    cost: 110,
    damage: 90,
    range: 2.5,
    rate: 0,
    maxLevel: 4,
    groundOnly: true,
    mines: { layEverySec: 3, maxMines: 4, radius: 1.0 },
    defaultTarget: 'first',
    branches: {
      a: {
        name: 'Cluster Mines',
        description: '+50% mine damage, +30% blast radius.',
        mineDamageMult: 1.5,
        mineRadiusMult: 1.3,
      },
      b: {
        name: 'Rapid Deploy',
        description: 'Lays mines twice as fast, +2 max mines.',
        layRateMult: 2,
        extraMines: 2,
      },
    },
  },
  barricade: {
    name: 'Barricade',
    description: 'Cheap wall for mazing. Does not attack.',
    kind: 'wall',
    cost: 25,
    damage: 0,
    range: 0,
    rate: 0,
    maxLevel: 1,
    defaultTarget: 'first',
  },
};

export const TOWER_UPGRADE = {
  COST_GROWTH: 1.5, // cost(level -> level+1) = baseCost * 1.5^level
  DAMAGE_PER_LEVEL: 0.3, // +30% of base damage per level
  RANGE_PER_LEVEL: 0.1, // +10% of base range per level
  MAX_LEVEL: 4,
  BRANCH_LEVEL: 3, // upgrading to this level requires choosing branch a or b
} as const;

export function towerCost(type: TowerType, mods: Mods = NO_MODS): number {
  return Math.round(TOWERS[type].cost * mods.cost);
}

/** Cost to upgrade from `level` to `level + 1`, or null at max level. */
export function upgradeCost(type: TowerType, level: number, mods: Mods = NO_MODS): number | null {
  if (level >= TOWERS[type].maxLevel) return null;
  return Math.round(TOWERS[type].cost * Math.pow(TOWER_UPGRADE.COST_GROWTH, level) * mods.cost);
}

export function towerDamage(type: TowerType, level: number): number {
  return TOWERS[type].damage * (1 + TOWER_UPGRADE.DAMAGE_PER_LEVEL * (level - 1));
}

export function towerRange(type: TowerType, level: number): number {
  return TOWERS[type].range * (1 + TOWER_UPGRADE.RANGE_PER_LEVEL * (level - 1));
}

export function branchOf(type: TowerType, branch: TowerBranch | null | undefined): BranchConfig | null {
  return branch ? (TOWERS[type].branches?.[branch] ?? null) : null;
}

export interface TowerStats {
  damage: number;
  range: number;
  rate: number;
}

/** Stats after level, branch and perks (support auras are added by the simulation per tower). */
export function towerStats(
  type: TowerType,
  level: number,
  branch: TowerBranch | null | undefined,
  mods: Mods = NO_MODS,
): TowerStats {
  const b = branchOf(type, branch);
  return {
    damage: towerDamage(type, level) * (b?.damageMult ?? 1) * mods.damage,
    range: towerRange(type, level) * (b?.rangeMult ?? 1) * mods.range,
    rate: TOWERS[type].rate * (b?.rateMult ?? 1) * mods.rate,
  };
}

/** Total gold spent on a tower at `level` (build + all upgrades), without perk discounts. */
export function totalInvested(type: TowerType, level: number): number {
  let total = TOWERS[type].cost;
  for (let l = 1; l < level; l++) total += upgradeCost(type, l) ?? 0;
  return total;
}

export function sellRefund(invested: number): number {
  return Math.floor(invested * GAME.SELL_REFUND);
}
