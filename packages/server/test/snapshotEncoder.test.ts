import { GAME, MAPS, type BoardSnapshot, type Snapshot } from '@maze/shared';
import { MatchSimulation } from '@maze/simulation';
import { SnapshotEncoder } from '../src/rooms/snapshotEncoder';

const board = (id: string, extra: Partial<BoardSnapshot> = {}): BoardSnapshot => ({
  id,
  alive: true,
  placement: null,
  wave: 1,
  waveState: 'active',
  nextWaveIn: 0,
  baseHp: 20,
  gold: 100,
  income: 10,
  towers: [
    {
      id: 1,
      type: 'arrow',
      x: 1,
      y: 1,
      level: 1,
      owner: id,
      targetMode: 'first',
      branch: null,
      invested: 50,
    },
  ],
  enemies: [{ id: 5, type: 'grunt', x: 1, y: 1, hp: 40, maxHp: 40, slowed: false }],
  projectiles: [],
  nextWave: null,
  beams: [],
  mines: [],
  perks: [],
  perkOffer: null,
  ...extra,
});

const snap = (...boards: BoardSnapshot[]): Snapshot => ({ tick: 2, serverTime: 100, mode: 'versus', boards });

describe('SnapshotEncoder', () => {
  it('per board: enemy type/maxHp once, slowed only when true, towers only on change', () => {
    const enc = new SnapshotEncoder();
    const first = enc.encode(snap(board('a'), board('b')));
    expect(first.boards[0].towers).toBeUndefined();
    expect(first.boards[0].enemies[0]).toEqual({ id: 5, type: 'grunt', x: 1, y: 1, hp: 40, maxHp: 40 });
    expect(first.boards[1].enemies[0]).toEqual({ id: 5, type: 'grunt', x: 1, y: 1, hp: 40, maxHp: 40 });
    enc.markTowersDirty('b');
    const second = enc.encode(
      snap(
        board('a', { enemies: [{ id: 5, type: 'grunt', x: 1, y: 1, hp: 40, maxHp: 40, slowed: true }] }),
        board('b'),
      ),
    );
    expect(second.boards[0].towers).toBeUndefined();
    expect(second.boards[1].towers).toHaveLength(1); // only the board that changed
    expect(second.boards[0].enemies[0]).toEqual({ id: 5, x: 1, y: 1, hp: 40, slowed: true });
    expect(second.boards[0].nextWave).toBeUndefined(); // unchanged
    expect(enc.encode(snap(board('a'), board('b'))).boards[1].towers).toBeUndefined();
  });

  it('always keeps shield, stun and burn state', () => {
    const enc = new SnapshotEncoder();
    const knight = {
      id: 7,
      type: 'shielded' as const,
      x: 1,
      y: 1,
      hp: 80,
      maxHp: 80,
      shield: 40,
      maxShield: 70,
    };
    enc.encode(snap(board('a', { enemies: [knight] })));
    const next = enc.encode(
      snap(board('a', { enemies: [{ ...knight, shield: 10, stunned: true, burning: true }] })),
    );
    expect(next.boards[0].enemies[0]).toEqual({
      id: 7,
      x: 1,
      y: 1,
      hp: 80,
      shield: 10,
      maxShield: 70,
      stunned: true,
      burning: true,
    });
  });

  it('reduces snapshot bandwidth by at least 30% over a real versus game', () => {
    const sim = new MatchSimulation({ mode: 'versus', map: MAPS.meadow, seed: 11, players: ['p', 'q'] });
    const placements = [
      [4, 4],
      [4, 9],
      [8, 3],
      [8, 10],
      [12, 5],
      [12, 8],
    ] as const;
    for (const id of ['p', 'q'])
      for (const [x, y] of placements) sim.enqueue(id, { kind: 'place', type: 'arrow', x, y });
    const enc = new SnapshotEncoder();
    let full = 0;
    let delta = 0;
    for (let i = 0; i < 20 * 150; i++) {
      if (i % 200 === 100) sim.enqueue('p', { kind: 'send', type: 'grunt' });
      sim.update(GAME.DT);
      for (const e of sim.drainEvents()) if (e.event.t.startsWith('tower_')) enc.markTowersDirty(e.board);
      if (sim.tick % 2 === 0) {
        const s = sim.getSnapshot();
        full += JSON.stringify(s).length;
        delta += JSON.stringify(enc.encode(s)).length;
      }
    }
    const reduction = 1 - delta / full;
    console.log(`snapshot bytes: full=${full} delta=${delta} reduction=${(reduction * 100).toFixed(1)}%`);
    expect(reduction).toBeGreaterThanOrEqual(0.3);
  });
});
