import {
  branchOf,
  ENEMIES,
  enemyHp,
  enemyShield,
  GAME,
  isBossWave,
  PERK_IDS,
  PERK_RULES,
  PERKS,
  waveClearBonus,
  type EnemyType,
  type PerkId,
} from '@maze/shared';
import type { Enemy } from '../entities';
import type { World } from '../world';
import { generateWave } from './waveGenerator';

export function spawnEnemy(
  world: World,
  type: EnemyType,
  spawnIndex = 0,
  wave = Math.max(1, world.waves.wave),
): Enemy {
  const cfg = ENEMIES[type];
  const spawn = world.map.spawns[spawnIndex % world.map.spawns.length];
  const hp = enemyHp(type, wave, world.difficulty.hpMult);
  const shield = enemyShield(type, wave, world.difficulty.hpMult);
  const e: Enemy = {
    id: ++world.ids.enemy,
    type,
    x: spawn.x + 0.5,
    y: spawn.y + 0.5,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    speed: cfg.speed,
    armor: cfg.armor,
    reward: cfg.reward,
    leakDamage: cfg.leakDamage,
    flying: cfg.flying,
    targetX: spawn.x,
    targetY: spawn.y,
    slowUntilTick: 0,
    slowMult: 1,
    stunUntilTick: 0,
    burn: null,
    abilityTimer: cfg.heal?.everySec ?? cfg.summon?.everySec ?? 0,
    enraged: false,
    remaining: world.grid.distAt(spawn.x, spawn.y),
    leaked: false,
    killedBy: null,
  };
  world.enemies.push(e);
  return e;
}

/** Spawn `type` at `parent`'s position, continuing along its route (splitter children, boss summons). */
export function spawnChild(world: World, type: EnemyType, parent: Enemy): Enemy {
  const child = spawnEnemy(world, type, 0, Math.max(1, world.waves.wave));
  child.x = parent.x;
  child.y = parent.y;
  child.targetX = parent.targetX;
  child.targetY = parent.targetY;
  child.remaining = parent.remaining;
  return child;
}

/** Wave-start economy: base income, interest perk, Gold Mine supports. */
function payWaveStart(world: World): void {
  world.gold += world.income;
  if (world.mods.interest > 0) {
    world.gold += Math.min(PERK_RULES.INTEREST_CAP, Math.floor(world.gold * world.mods.interest));
  }
  for (const t of world.towers.values()) world.gold += branchOf(t.type, t.branch)?.goldPerWave ?? 0;
}

/** Every few waves the player picks 1 of 3 perks. One-off perks can repeat; lasting ones are offered once. */
function offerPerks(world: World): void {
  if (world.waves.wave % PERK_RULES.EVERY_WAVES !== 0) return;
  const pool: PerkId[] = PERK_IDS.filter((id) => !PERKS[id].mods || !world.perks.includes(id));
  const options: PerkId[] = [];
  while (options.length < PERK_RULES.OFFER_SIZE && pool.length > 0) {
    options.push(pool.splice(Math.floor(world.rng.float() * pool.length), 1)[0]);
  }
  if (options.length === 0) return;
  world.perkOffers.push(options);
  world.events.push({ t: 'perk_offered', options });
}

export function startNextWave(world: World): void {
  const w = world.waves;
  w.wave += 1;
  const list = w.nextList;
  const entries = list.map((type, i) => ({ type, spawnIndex: i % world.map.spawns.length }));
  if (w.mode === 'timed') {
    // Unfinished spawns of the previous wave keep coming; the new wave queues behind them.
    if (w.queue.length === 0) w.spawnTimer = 0;
    w.queue.push(...entries);
    w.buildTimer = w.interval;
  } else {
    w.queue = entries;
    w.spawnTimer = 0;
    w.buildTimer = 0;
  }
  w.state = 'spawning';
  payWaveStart(world);
  w.nextList = generateWave(w.wave + 1, world.rng);
  world.events.push({ t: 'wave_started', wave: w.wave, boss: isBossWave(w.wave) });
  offerPerks(world);
}

/** Skipping the build phase gives a small bonus; not allowed right before a boss wave. */
export function canSkip(world: World): boolean {
  const w = world.waves;
  return w.enabled && w.mode === 'clear' && w.state === 'building' && !isBossWave(w.wave + 1);
}

export function skipBuildPhase(world: World): number {
  const bonus = Math.floor(world.waves.buildTimer) * GAME.WAVE_SKIP_BONUS_PER_SEC;
  world.gold += bonus;
  startNextWave(world);
  return bonus;
}

export function updateWaves(world: World): void {
  const w = world.waves;
  if (!w.enabled) return;
  if (w.state === 'building') {
    w.buildTimer -= world.dt;
    if (w.buildTimer > 1e-9) return;
    startNextWave(world); // falls through so the first enemy spawns this tick
  } else if (w.mode === 'timed') {
    w.buildTimer -= world.dt;
    if (w.buildTimer <= 1e-9) startNextWave(world);
  }
  if (w.state === 'spawning') {
    w.spawnTimer -= world.dt;
    while (w.spawnTimer <= 1e-9 && w.queue.length > 0) {
      const entry = w.queue.shift()!;
      spawnEnemy(world, entry.type, entry.spawnIndex, w.wave);
      w.spawnTimer += ENEMIES[entry.type].spawnIntervalSec;
    }
    if (w.queue.length === 0) w.state = 'active';
    return;
  }
  // active: cleared once every enemy is gone (checked after deaths are resolved)
}

/** Enemies sent by opponents (versus): spawned one by one, round-robin over the spawns. */
export function queueSend(world: World, type: EnemyType): void {
  world.sends.queue.push(type);
}

export function updateSends(world: World): void {
  const s = world.sends;
  if (s.queue.length === 0) {
    s.timer = Math.max(0, s.timer - world.dt);
    return;
  }
  s.timer -= world.dt;
  while (s.timer <= 1e-9 && s.queue.length > 0) {
    spawnEnemy(world, s.queue.shift()!, s.spawnIndex++, Math.max(1, world.waves.wave));
    s.timer += s.interval;
  }
}

export function checkWaveCleared(world: World): void {
  const w = world.waves;
  if (!w.enabled || w.state !== 'active' || world.enemies.length > 0 || world.result) return;
  if (w.mode === 'timed') {
    // Waves keep coming on the timer; clearing early just pays the bonus once.
    if (world.sends.queue.length > 0 || w.clearedWave >= w.wave) return;
    w.clearedWave = w.wave;
    const bonus = waveClearBonus(w.wave);
    world.gold += bonus;
    world.events.push({ t: 'wave_cleared', wave: w.wave, bonus });
    return;
  }
  const bonus = waveClearBonus(w.wave);
  world.gold += bonus;
  world.events.push({ t: 'wave_cleared', wave: w.wave, bonus });
  if (w.wave >= GAME.WIN_WAVE) {
    world.result = 'win';
    return;
  }
  w.state = 'building';
  w.buildTimer = GAME.BUILD_TIME_SEC;
}
