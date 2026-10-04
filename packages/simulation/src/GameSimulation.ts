import {
  DIFFICULTY,
  GAME,
  NO_MODS,
  PERKS,
  TOWERS,
  perkMods,
  sellRefund,
  towerCost,
  upgradeCost,
  TOWER_UPGRADE,
  type PerkId,
  type TowerBranch,
  type CommandResult,
  type Difficulty,
  type EnemySnap,
  type EnemyType,
  type GameCommand,
  type GameEvent,
  type GameOverPayload,
  type MapData,
  type PlayerStats,
  type BoardState,
  type TargetMode,
  type TowerSnap,
  type TowerType,
  type Vec2,
} from '@maze/shared';
import type { Enemy, Tower } from './entities';
import { Grid } from './grid/Grid';
import { Rng } from './rng';
import { updateAuras } from './systems/AuraSystem';
import { resolveDeathsAndLeaks } from './systems/EconomySystem';
import { fireTowers } from './systems/FiringSystem';
import { moveEnemies } from './systems/MovementSystem';
import { updateProjectiles } from './systems/ProjectileSystem';
import { SpatialHash } from './systems/SpatialHash';
import { updateEnemyAbilities } from './systems/EnemyAbilitySystem';
import { updateMines } from './systems/MineSystem';
import { isBurning, isSlowed, isStunned, updateStatus } from './systems/StatusSystem';
import { updateTargeting } from './systems/TargetingSystem';
import { generateWave, previewOf } from './systems/waveGenerator';
import {
  canSkip,
  checkWaveCleared,
  queueSend,
  skipBuildPhase,
  spawnEnemy,
  updateSends,
  updateWaves,
} from './systems/WaveSystem';
import { statsFor, type WaveMode, type World } from './world';

export interface SimulationOptions {
  map: MapData;
  seed: number;
  difficulty?: Difficulty;
  players?: string[];
  /** Disable the wave system (tests spawn enemies by hand). Default true. */
  waves?: boolean;
  /** 'clear' (solo, default): build phase after each cleared wave. 'timed' (versus): waves every `waveIntervalSec`. */
  waveMode?: WaveMode;
  waveIntervalSec?: number;
  firstBuildSec?: number;
  startGold?: number;
  baseHp?: number;
  income?: number;
  sendIntervalSec?: number;
}

interface QueuedCommand {
  playerId: string;
  cmd: GameCommand;
  onResult?: (res: CommandResult) => void;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pure, deterministic game simulation. No I/O, no wall clock, no Math.random:
 * time comes from `dt` and randomness from the seeded RNG. Same seed + same commands = same result.
 */
export class GameSimulation {
  private readonly world: World;
  private readonly queue: QueuedCommand[] = [];
  readonly seed: number;
  readonly difficulty: Difficulty;

  constructor(opts: SimulationOptions) {
    this.seed = opts.seed >>> 0;
    this.difficulty = opts.difficulty ?? 'normal';
    const diff = DIFFICULTY[this.difficulty];
    const rng = new Rng(this.seed);
    const map = opts.map;
    this.world = {
      map,
      grid: new Grid(map),
      rng,
      dt: GAME.DT,
      tick: 0,
      gold: opts.startGold ?? diff.startGold,
      baseHp: opts.baseHp ?? diff.baseHp,
      difficulty: diff,
      enemies: [],
      towers: new Map(),
      projectiles: [],
      hash: new SpatialHash(map.width, map.height, GAME.SPATIAL_CELL_SIZE),
      events: [],
      stats: new Map(),
      ids: { enemy: 0, tower: 0, projectile: 0, mine: 0 },
      mines: [],
      beams: [],
      perks: [],
      perkOffers: [],
      mods: { ...NO_MODS },
      pathCache: { version: -1, cells: [] },
      auraDirty: false,
      income: opts.income ?? 0,
      sends: { queue: [], timer: 0, spawnIndex: 0, interval: opts.sendIntervalSec ?? 0.35 },
      result: null,
      waves: {
        enabled: opts.waves ?? true,
        mode: opts.waveMode ?? 'clear',
        interval: opts.waveIntervalSec ?? GAME.BUILD_TIME_SEC,
        clearedWave: 0,
        wave: 0,
        state: 'building',
        buildTimer: opts.firstBuildSec ?? GAME.FIRST_BUILD_TIME_SEC,
        queue: [],
        spawnTimer: 0,
        nextList: generateWave(1, rng),
      },
    };
    for (const p of opts.players ?? []) statsFor(this.world, p);
  }

  // ---------------------------------------------------------------- loop

  /** Queue a command; it is applied at the start of the next `update` (commands → systems). */
  enqueue(playerId: string, cmd: GameCommand, onResult?: (res: CommandResult) => void): void {
    this.queue.push({ playerId, cmd, onResult });
  }

  update(dt: number = GAME.DT): void {
    const w = this.world;
    w.dt = dt;
    const pending = this.queue.splice(0);
    for (const q of pending) q.onResult?.(this.applyCommand(q.playerId, q.cmd));
    if (w.result) return;
    w.tick += 1;
    updateWaves(w);
    updateSends(w);
    moveEnemies(w);
    w.hash.rebuild(w.enemies);
    updateAuras(w);
    updateEnemyAbilities(w);
    const byId = new Map<number, Enemy>();
    for (const e of w.enemies) byId.set(e.id, e);
    updateTargeting(w, byId);
    fireTowers(w, byId);
    updateProjectiles(w, byId);
    updateMines(w);
    // Burn ticks here; slow and stun are tick-stamped and expire implicitly.
    updateStatus(w);
    resolveDeathsAndLeaks(w);
    checkWaveCleared(w);
  }

  // ---------------------------------------------------------------- commands

  applyCommand(playerId: string, cmd: GameCommand): CommandResult {
    if (this.world.result) return { ok: false, code: 'GAME_NOT_RUNNING' };
    switch (cmd.kind) {
      case 'place':
        return this.placeTower(playerId, cmd.type, cmd.x, cmd.y);
      case 'upgrade':
        return this.upgradeTower(playerId, cmd.towerId, cmd.branch);
      case 'sell':
        return this.sellTower(cmd.towerId);
      case 'setTarget':
        return this.setTargetMode(cmd.towerId, cmd.mode);
      case 'skipWave':
        return this.skipWave();
      case 'choosePerk':
        return this.choosePerk(cmd.perk);
      case 'send':
        return { ok: false, code: 'NOT_AVAILABLE' }; // handled by MatchSimulation
    }
  }

  placeTower(playerId: string, type: TowerType, x: number, y: number): CommandResult {
    const w = this.world;
    const enemyCells = this.groundEnemyCells();
    const cellErr = w.grid.checkCell(x, y, enemyCells);
    if (cellErr) return { ok: false, code: cellErr };
    const cost = towerCost(type, w.mods);
    if (w.gold < cost) return { ok: false, code: 'NOT_ENOUGH_GOLD' };
    const path = w.grid.checkPath(x, y, enemyCells);
    if (!path.ok) return { ok: false, code: 'BLOCKS_PATH' };

    const tower: Tower = {
      id: ++w.ids.tower,
      type,
      x,
      y,
      cx: x + 0.5,
      cy: y + 0.5,
      level: 1,
      branch: null,
      owner: playerId,
      targetMode: TOWERS[type].defaultTarget,
      cooldown: 0,
      targetId: null,
      retargetTimer: 0,
      invested: cost,
      damageMult: 1,
      rangeMult: 1,
      ramp: 1,
      beamTargets: [],
      layTimer: 0,
    };
    w.grid.placeTower(x, y, tower.id, path.dist);
    w.towers.set(tower.id, tower);
    w.gold -= cost;
    w.auraDirty = true;
    const stats = statsFor(w, playerId);
    stats.goldSpent += cost;
    stats.towersBuilt += 1;
    w.events.push({ t: 'tower_built', tower: toTowerSnap(tower) }, { t: 'path_updated' });
    return { ok: true };
  }

  /** Upgrading to BRANCH_LEVEL (3) requires choosing a specialisation; it is fixed afterwards. */
  upgradeTower(playerId: string, towerId: number, branch?: TowerBranch): CommandResult {
    const w = this.world;
    const t = w.towers.get(towerId);
    if (!t) return { ok: false, code: 'TOWER_NOT_FOUND' };
    const cost = upgradeCost(t.type, t.level, w.mods);
    if (cost === null || t.level >= TOWER_UPGRADE.MAX_LEVEL) return { ok: false, code: 'MAX_LEVEL' };
    const choosing = t.level + 1 === TOWER_UPGRADE.BRANCH_LEVEL && !!TOWERS[t.type].branches;
    if (choosing && !branch) return { ok: false, code: 'BRANCH_REQUIRED' };
    if (w.gold < cost) return { ok: false, code: 'NOT_ENOUGH_GOLD' };
    w.gold -= cost;
    t.level += 1;
    if (choosing) t.branch = branch!;
    t.invested += cost;
    w.auraDirty = true;
    statsFor(w, playerId).goldSpent += cost;
    w.events.push({ t: 'tower_upgraded', id: t.id, level: t.level, branch: t.branch });
    return { ok: true };
  }

  /** Pick one perk from the oldest pending offer. */
  choosePerk(perk: PerkId): CommandResult {
    const w = this.world;
    const offer = w.perkOffers[0];
    if (!offer) return { ok: false, code: 'NO_PERK_OFFER' };
    if (!offer.includes(perk)) return { ok: false, code: 'INVALID_PERK' };
    w.perkOffers.shift();
    w.perks.push(perk);
    w.mods = perkMods(w.perks);
    w.gold += PERKS[perk].gold ?? 0;
    w.baseHp += PERKS[perk].baseHp ?? 0;
    w.auraDirty = true; // range perks change aura coverage
    w.events.push({ t: 'perk_chosen', perk });
    return { ok: true };
  }

  sellTower(towerId: number): CommandResult {
    const w = this.world;
    const t = w.towers.get(towerId);
    if (!t) return { ok: false, code: 'TOWER_NOT_FOUND' };
    const refund = sellRefund(t.invested);
    w.gold += refund;
    w.towers.delete(towerId);
    w.mines = w.mines.filter((m) => m.towerId !== towerId);
    w.grid.removeTower(t.x, t.y);
    w.auraDirty = true;
    w.events.push({ t: 'tower_sold', id: t.id, refund }, { t: 'path_updated' });
    return { ok: true };
  }

  setTargetMode(towerId: number, mode: TargetMode): CommandResult {
    const t = this.world.towers.get(towerId);
    if (!t) return { ok: false, code: 'TOWER_NOT_FOUND' };
    t.targetMode = mode;
    t.targetId = null;
    this.world.events.push({ t: 'tower_target', id: t.id, mode });
    return { ok: true };
  }

  skipWave(): CommandResult {
    if (!canSkip(this.world)) return { ok: false, code: 'CANNOT_SKIP' };
    skipBuildPhase(this.world);
    return { ok: true };
  }

  // ---------------------------------------------------------------- queries

  /** Spawn helper (tests, tools). */
  spawnEnemy(type: EnemyType, spawnIndex = 0): number {
    return spawnEnemy(this.world, type, spawnIndex).id;
  }

  getSnapshot(): BoardState {
    const w = this.world;
    const counting = w.waves.enabled && (w.waves.state === 'building' || w.waves.mode === 'timed');
    return {
      wave: w.waves.wave,
      waveState: w.waves.state,
      nextWaveIn: counting ? r2(Math.max(0, w.waves.buildTimer)) : 0,
      baseHp: w.baseHp,
      gold: w.gold,
      income: w.income,
      towers: this.getTowers(),
      enemies: w.enemies.map((e): EnemySnap => ({
        id: e.id,
        type: e.type,
        x: r2(e.x),
        y: r2(e.y),
        hp: Math.ceil(e.hp),
        maxHp: e.maxHp,
        slowed: isSlowed(w, e),
        ...(e.maxShield > 0 ? { shield: Math.ceil(e.shield), maxShield: e.maxShield } : {}),
        ...(isStunned(w, e) ? { stunned: true } : {}),
        ...(isBurning(w, e) ? { burning: true } : {}),
      })),
      projectiles: w.projectiles.map((p) => ({ id: p.id, x: r2(p.x), y: r2(p.y), kind: p.kind })),
      nextWave: w.waves.enabled ? previewOf(w.waves.wave + 1, w.waves.nextList) : null,
      beams: [...w.beams],
      mines: w.mines.flatMap((m) => [m.x, m.y]),
      perks: [...w.perks],
      perkOffer: w.perkOffers[0] ? [...w.perkOffers[0]] : null,
    };
  }

  getTowers(): TowerSnap[] {
    return [...this.world.towers.values()].map(toTowerSnap);
  }

  drainEvents(): GameEvent[] {
    return this.world.events.splice(0);
  }

  getStats(): PlayerStats[] {
    return [...this.world.stats.values()].map((s) => ({ ...s, damageDealt: Math.round(s.damageDealt) }));
  }

  getGameOver(): GameOverPayload | null {
    const w = this.world;
    if (!w.result) return null;
    return {
      mode: 'solo',
      result: w.result,
      winners: [],
      wavesReached: w.waves.wave,
      durationSec: Math.floor(w.tick * GAME.DT),
      stats: this.getStats(),
    };
  }

  // ---------------------------------------------------------------- versus hooks (used by MatchSimulation)

  /** Queue an enemy sent by an opponent. False when the incoming queue is full. */
  receiveSend(type: EnemyType, maxPending: number): boolean {
    if (this.world.sends.queue.length >= maxPending) return false;
    queueSend(this.world, type);
    return true;
  }

  get pendingSends(): number {
    return this.world.sends.queue.length;
  }

  trySpend(cost: number): boolean {
    if (this.world.gold < cost) return false;
    this.world.gold -= cost;
    return true;
  }

  addIncome(amount: number): void {
    this.world.income += amount;
  }

  get income(): number {
    return this.world.income;
  }

  /** Record a send in the owner's stats. */
  recordSend(playerId: string, cost: number): void {
    const s = statsFor(this.world, playerId);
    s.enemiesSent += 1;
    s.goldSpent += cost;
  }

  /** Leaving or timing out in versus: the board is knocked out. */
  forfeit(): void {
    if (!this.world.result) this.world.result = 'lose';
  }

  get isOver(): boolean {
    return this.world.result !== null;
  }
  get tick(): number {
    return this.world.tick;
  }
  get gold(): number {
    return this.world.gold;
  }
  get baseHp(): number {
    return this.world.baseHp;
  }
  get wave(): number {
    return this.world.waves.wave;
  }
  get waveState() {
    return this.world.waves.state;
  }
  get map(): MapData {
    return this.world.map;
  }
  get enemyCount(): number {
    return this.world.enemies.length;
  }
  /** Current flow field (read-only view). */
  get flowField(): Int32Array {
    return this.world.grid.dist;
  }

  /** Test/tool hook: direct access to internal state. Never use from the server. */
  inspect(): World {
    return this.world;
  }

  private groundEnemyCells(): Vec2[] {
    const cells: Vec2[] = [];
    for (const e of this.world.enemies) {
      if (e.flying || e.hp <= 0 || e.leaked) continue;
      cells.push({ x: Math.floor(e.x), y: Math.floor(e.y) });
      cells.push({ x: e.targetX, y: e.targetY });
    }
    return cells;
  }
}

export function toTowerSnap(t: Tower): TowerSnap {
  return {
    id: t.id,
    type: t.type,
    x: t.x,
    y: t.y,
    level: t.level,
    owner: t.owner,
    targetMode: t.targetMode,
    branch: t.branch,
    invested: t.invested,
  };
}
