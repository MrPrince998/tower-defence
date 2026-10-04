/**
 * Headless balance harness (Phase 7). Plays full games through the public GameSimulation API with scripted
 * strategies and prints the average wave reached.
 *
 *   npm run balance -- --games 34 --difficulty normal --map meadow
 */
import {
  buildBlocked,
  computeFlowField,
  INF,
  isBuildableCell,
  MAPS,
  TOWERS,
  towerRange,
  tracePath,
  type Difficulty,
  type MapData,
  type TowerSnap,
  type TowerType,
  type Vec2,
} from '@maze/shared';
import { GameSimulation } from '../src';

interface Strategy {
  name: string;
  /** Tower type to build next (or null to upgrade instead). */
  nextType(built: TowerSnap[], wave: number): TowerType | null;
  /** Weight of path lengthening vs. path coverage when choosing a cell. */
  mazeWeight: number;
  upgradeFirst: (built: TowerSnap[]) => boolean;
  branch: 'a' | 'b';
}

const MIXED_CYCLE: TowerType[] = [
  'arrow',
  'arrow',
  'frost',
  'cannon',
  'arrow',
  'sniper',
  'support',
  'cannon',
  'arrow',
  'frost',
];

const STRATEGIES: Strategy[] = [
  {
    name: 'arrows-only',
    nextType: () => 'arrow',
    mazeWeight: 0,
    upgradeFirst: (b) => b.length >= 18,
    branch: 'b',
  },
  {
    name: 'mixed',
    nextType: (b, wave) => {
      const t = MIXED_CYCLE[b.length % MIXED_CYCLE.length];
      return wave < 4 && (t === 'sniper' || t === 'support') ? 'arrow' : t;
    },
    mazeWeight: 0.4,
    upgradeFirst: (b) => b.length >= 16,
    branch: 'a',
  },
  {
    name: 'maze-heavy',
    nextType: (b) => (b.length % 4 === 3 ? 'frost' : b.length % 5 === 4 ? 'cannon' : 'arrow'),
    mazeWeight: 3,
    upgradeFirst: (b) => b.length >= 26,
    branch: 'b',
  },
  {
    name: 'new-towers',
    nextType: (b, wave) => {
      const cycle: TowerType[] = [
        'arrow',
        'arrow',
        'frost',
        'tesla',
        'arrow',
        'laser',
        'support',
        'mines',
        'arrow',
        'barricade',
      ];
      const t = cycle[b.length % cycle.length];
      return wave < 4 && (t === 'laser' || t === 'tesla' || t === 'support') ? 'arrow' : t;
    },
    mazeWeight: 0.8,
    upgradeFirst: (b) => b.length >= 18,
    branch: 'a',
  },
];

function pathCells(map: MapData, dist: Int32Array): Vec2[] {
  return map.spawns.flatMap((s) => tracePath(map, dist, s));
}

function totalPathLength(map: MapData, dist: Int32Array): number {
  return map.spawns.reduce((sum, s) => sum + dist[s.y * map.width + s.x], 0);
}

/** Pick the best cell: coverage of path cells in range, plus (weighted) extra path length. */
function chooseCell(sim: GameSimulation, strategy: Strategy, type: TowerType): Vec2 | null {
  const map = sim.map;
  const towers = sim.getTowers();
  const blocked = buildBlocked(map, towers);
  const baseDist = computeFlowField(map.width, map.height, blocked, map.goal);
  const baseLen = totalPathLength(map, baseDist);
  const path = pathCells(map, baseDist);
  const range = towerRange(type, 1);
  const occupied = new Set(sim.getSnapshot().enemies.map((e) => `${Math.floor(e.x)},${Math.floor(e.y)}`));
  let best: Vec2 | null = null;
  let bestScore = -Infinity;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (!isBuildableCell(map, x, y) || blocked[i] || occupied.has(`${x},${y}`)) continue;
      let coverage = 0;
      for (const c of path) if (Math.hypot(c.x - x, c.y - y) <= range) coverage++;
      if (type !== 'support' && type !== 'barricade' && coverage === 0) continue;
      let lengthGain = 0;
      if (strategy.mazeWeight > 0) {
        blocked[i] = 1;
        const dist = computeFlowField(map.width, map.height, blocked, map.goal);
        blocked[i] = 0;
        const len = totalPathLength(map, dist);
        if (len >= INF) continue;
        lengthGain = len - baseLen;
      }
      let score = coverage + strategy.mazeWeight * lengthGain;
      if (type === 'support')
        score = towers.filter((t) => Math.hypot(t.x - x, t.y - y) <= range).length * 3 + coverage * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

function spend(sim: GameSimulation, strategy: Strategy): void {
  for (let guard = 0; guard < 20; guard++) {
    const built = sim.getTowers();
    const wantUpgrade = strategy.upgradeFirst(built);
    if (wantUpgrade) {
      const candidate = built
        .filter((t) => t.type !== 'support' && t.type !== 'barricade' && t.level < 4)
        .sort((a, b) => a.level - b.level || TOWERS[b.type].damage - TOWERS[a.type].damage)[0];
      const branch = candidate?.level === 2 ? strategy.branch : undefined;
      if (candidate && sim.upgradeTower(candidate.type, candidate.id, branch).ok) continue;
    }
    const type = strategy.nextType(built, sim.wave);
    if (!type || sim.gold < TOWERS[type].cost) return;
    const cell = chooseCell(sim, strategy, type);
    // Towers are owned by their type so `--breakdown` can report damage per tower type.
    if (!cell || !sim.placeTower(type, type, cell.x, cell.y).ok) return;
  }
}

export function playGame(strategy: Strategy, seed: number, difficulty: Difficulty, map: MapData) {
  const sim = new GameSimulation({ map, seed, difficulty, players: ['bot'] });
  const maxTicks = 20 * 60 * 60; // one hour of game time
  while (!sim.isOver && sim.tick < maxTicks) {
    if (sim.tick % 20 === 0) {
      const offer = sim.getSnapshot().perkOffer;
      if (offer) sim.choosePerk(offer.includes('sharpened') ? 'sharpened' : offer[0]);
      spend(sim, strategy);
      if (sim.waveState === 'building') sim.skipWave();
    }
    sim.update();
    sim.drainEvents();
  }
  const over = sim.getGameOver();
  const damage: Record<string, number> = {};
  for (const s of sim.getStats()) damage[s.userId] = (damage[s.userId] ?? 0) + s.damageDealt;
  return { wave: over?.wavesReached ?? sim.wave, win: over?.result === 'win', damage };
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const isMain = process.argv[1]?.endsWith('balance-bot.ts');
if (isMain) {
  const games = Number(arg('games', '34'));
  const difficulty = arg('difficulty', 'normal') as Difficulty;
  const map = MAPS[arg('map', 'meadow')];
  const only = arg('strategy', '');
  const started = performance.now();
  const rows: string[][] = [];
  for (const strategy of STRATEGIES.filter((s) => !only || s.name === only)) {
    const t0 = performance.now();
    const waves: number[] = [];
    let wins = 0;
    const damage: Record<string, number> = {};
    for (let g = 0; g < games; g++) {
      const r = playGame(strategy, 1000 + g, difficulty, map);
      waves.push(r.wave);
      if (r.win) wins++;
      for (const [k, v] of Object.entries(r.damage)) damage[k] = (damage[k] ?? 0) + v;
    }
    if (process.argv.includes('--breakdown')) {
      const total = Object.values(damage).reduce((a, b) => a + b, 0) || 1;
      const parts = Object.entries(damage)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`);
      console.log(`${strategy.name} damage share: ${parts.join(', ')}`);
    }
    const avg = waves.reduce((a, b) => a + b, 0) / waves.length;
    rows.push([
      strategy.name,
      String(games),
      avg.toFixed(1),
      String(Math.min(...waves)),
      String(Math.max(...waves)),
      `${((wins / games) * 100).toFixed(0)}%`,
      `${((performance.now() - t0) / games).toFixed(0)} ms`,
    ]);
  }
  const header = ['strategy', 'games', 'avg wave', 'min', 'max', 'wins', 'ms/game'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => '| ' + r.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  console.log(`\nmap=${map.id} difficulty=${difficulty}`);
  console.log(line(header));
  console.log('|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|');
  for (const r of rows) console.log(line(r));
  console.log(`\ntotal ${((performance.now() - started) / 1000).toFixed(1)} s`);
}
