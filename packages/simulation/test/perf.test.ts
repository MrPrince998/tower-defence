import { MAPS, TOWER_TYPES } from '@maze/shared';
import { GameSimulation } from '../src';

describe('performance', () => {
  it('300 enemies and 40 towers: update averages under 5 ms', () => {
    const sim = new GameSimulation({ map: MAPS.meadow, seed: 3, waves: false, players: ['p'] });
    sim.inspect().gold = 1_000_000;
    let placed = 0;
    for (let y = 0; y < 14 && placed < 40; y += 2) {
      for (let x = 2; x < 18 && placed < 40; x += 2) {
        if (sim.placeTower('p', TOWER_TYPES[placed % TOWER_TYPES.length], x, y).ok) placed++;
      }
    }
    expect(placed).toBe(40);
    const types = ['grunt', 'runner', 'tank', 'flyer'] as const;
    for (let i = 0; i < 300; i++) sim.spawnEnemy(types[i % 4], i % 2);
    for (const e of sim.inspect().enemies) e.hp = e.maxHp = 1e9; // keep them alive for the whole run
    for (let i = 0; i < 20; i++) sim.update(); // warm-up
    const ticks = 200;
    const start = performance.now();
    for (let i = 0; i < ticks; i++) sim.update();
    const avg = (performance.now() - start) / ticks;
    expect(sim.enemyCount).toBeGreaterThan(200);
    expect(avg).toBeLessThan(5);
  });
});
