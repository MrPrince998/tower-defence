import { GAME, parseMap, type MapData } from '@maze/shared';
import { GameSimulation, type SimulationOptions } from '../src';

export const corridor = parseMap('corridor', 'Corridor', ['S........G']);

/** 12x5 open field, spawn left-middle, goal right-middle. */
export const field = parseMap('field', 'Field', [
  '............',
  '............',
  'S..........G',
  '............',
  '............',
]);

export function newSim(map: MapData, opts: Partial<SimulationOptions> = {}): GameSimulation {
  return new GameSimulation({ map, seed: 42, waves: false, players: ['p1'], ...opts });
}

export function runTicks(sim: GameSimulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.update(GAME.DT);
}

/** Ticks until the given enemy leaks (or `max` elapses). */
export function ticksUntilLeak(sim: GameSimulation, max = 5000): number {
  for (let i = 1; i <= max; i++) {
    sim.update(GAME.DT);
    if (sim.drainEvents().some((e) => e.t === 'enemy_leaked')) return i;
  }
  return -1;
}

export function enemy(sim: GameSimulation, id: number) {
  return sim.inspect().enemies.find((e) => e.id === id);
}
