import type { EnemyType, TargetMode, TowerBranch, TowerType } from '@maze/shared';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number; // world tiles; cell centers are at (cx + 0.5, cy + 0.5)
  y: number;
  hp: number;
  maxHp: number;
  shield: number; // absorbs damage before hp
  maxShield: number;
  speed: number;
  armor: number;
  reward: number;
  leakDamage: number;
  flying: boolean;
  targetX: number; // target cell (ground) — flyers always target the goal
  targetY: number;
  slowUntilTick: number;
  slowMult: number; // speed multiplier while slowed (strongest active slow)
  stunUntilTick: number;
  burn: { dps: number; untilTick: number; owner: string } | null;
  remaining: number; // distance left to the goal in tiles (for first/last targeting)
  leaked: boolean;
  killedBy: string | null;
  abilityTimer: number; // healer pulse / boss summon countdown (seconds)
  enraged: boolean;
}

export interface Tower {
  id: number;
  type: TowerType;
  x: number; // cell
  y: number;
  cx: number; // center in world tiles
  cy: number;
  level: number;
  branch: TowerBranch | null;
  owner: string;
  targetMode: TargetMode;
  cooldown: number;
  targetId: number | null;
  retargetTimer: number;
  invested: number;
  damageMult: number; // from support aura
  rangeMult: number;
  /** Laser: current ramp multiplier and the enemies its beams are on. */
  ramp: number;
  beamTargets: number[];
  /** Mine layer: seconds until the next mine. */
  layTimer: number;
}

export interface Projectile {
  id: number;
  kind: TowerType;
  x: number;
  y: number;
  targetId: number;
  tx: number; // last known target position
  ty: number;
  damage: number;
  splashRadius: number;
  groundOnlySplash: boolean;
  ignoreArmor: boolean;
  slow: { mult: number; durationSec: number; radius: number } | null;
  burn: { pctPerSec: number; durationSec: number } | null;
  owner: string;
}

export interface Mine {
  id: number;
  towerId: number;
  x: number; // cell center (tiles)
  y: number;
  damage: number;
  radius: number;
  owner: string;
}
