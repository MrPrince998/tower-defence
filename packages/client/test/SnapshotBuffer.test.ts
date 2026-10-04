import type { BoardSnapshot, EnemySnap, ProjectileSnap, Snapshot } from '@maze/shared';
import { SnapshotBuffer } from '../src/game/SnapshotBuffer';

const board = (id: string, enemies: EnemySnap[], projectiles: ProjectileSnap[] = []): BoardSnapshot => ({
  id,
  alive: true,
  placement: null,
  wave: 1,
  waveState: 'active',
  nextWaveIn: 0,
  baseHp: 20,
  gold: 0,
  income: 0,
  enemies,
  projectiles,
  beams: [],
  mines: [],
  perks: [],
  perkOffer: null,
});

const snap = (serverTime: number, ...boards: BoardSnapshot[]): Snapshot => ({
  tick: serverTime / 50,
  serverTime,
  mode: 'versus',
  boards,
});

const grunt = (x: number, full = false): EnemySnap =>
  full ? { id: 1, type: 'grunt', maxHp: 40, x, y: 2, hp: 40 } : { id: 1, x, y: 2, hp: 30 };

describe('SnapshotBuffer', () => {
  it('interpolates 100 ms in the past between surrounding snapshots', () => {
    const buf = new SnapshotBuffer();
    buf.reset(snap(0, board('a', [grunt(0, true)])), 1000);
    buf.push(snap(100, board('a', [grunt(1)])), 1100);
    buf.push(snap(200, board('a', [grunt(2)])), 1200);
    const f = buf.sample('a', 1250, 100); // render time = 150
    expect(f.enemies).toHaveLength(1);
    expect(f.enemies[0]).toMatchObject({ id: 1, type: 'grunt', maxHp: 40 });
    expect(f.enemies[0].x).toBeCloseTo(1.5);
  });

  it('keeps boards separate even when ids collide', () => {
    const buf = new SnapshotBuffer();
    buf.reset(
      snap(
        0,
        board('a', [grunt(0, true)]),
        board('b', [{ id: 1, type: 'tank', maxHp: 200, x: 5, y: 5, hp: 200 }]),
      ),
      0,
    );
    buf.push(snap(100, board('a', [grunt(1)]), board('b', [{ id: 1, x: 6, y: 5, hp: 150 }])), 100);
    expect(buf.sample('a', 1000, 100).enemies[0]).toMatchObject({ type: 'grunt', x: 1 });
    expect(buf.sample('b', 1000, 100).enemies[0]).toMatchObject({ type: 'tank', maxHp: 200, hp: 150, x: 6 });
    expect(buf.sample('nobody', 1000, 100).enemies).toEqual([]);
  });

  it('clamps to the newest snapshot instead of extrapolating', () => {
    const buf = new SnapshotBuffer();
    buf.reset(snap(0, board('a', [grunt(0, true)])), 0);
    buf.push(snap(100, board('a', [grunt(1)])), 100);
    expect(buf.sample('a', 5000, 100).enemies[0].x).toBe(1);
    expect(buf.sample('a', -500, 100).enemies[0].x).toBe(0);
  });

  it('restores omitted fields and drops entities that disappeared', () => {
    const buf = new SnapshotBuffer();
    buf.reset(
      snap(
        0,
        board(
          'a',
          [{ id: 1, type: 'tank', maxHp: 200, x: 0, y: 0, hp: 200, slowed: false }],
          [{ id: 9, x: 1, y: 1, kind: 'cannon' }],
        ),
      ),
      0,
    );
    buf.push(
      snap(100, board('a', [{ id: 1, x: 0.5, y: 0, hp: 150, slowed: true }], [{ id: 9, x: 2, y: 1 }])),
      100,
    );
    buf.push(snap(200, board('a', [], [])), 200);
    const mid = buf.sample('a', 150, 100);
    expect(mid.enemies[0]).toMatchObject({ type: 'tank', maxHp: 200, hp: 150, slowed: true });
    expect(mid.projectiles[0]).toMatchObject({ kind: 'cannon', x: 1.5 });
    expect(buf.sample('a', 300, 100).enemies).toEqual([]);
  });

  it('handles clock jumps (pause/resume) by re-estimating the offset', () => {
    const buf = new SnapshotBuffer();
    buf.reset(snap(0, board('a', [grunt(0, true)])), 0);
    buf.push(snap(100, board('a', [grunt(1)])), 100);
    buf.push(snap(200, board('a', [grunt(2)])), 60_200); // resumed after a long pause
    buf.push(snap(300, board('a', [grunt(3)])), 60_300);
    expect(buf.sample('a', 60_350, 100).enemies[0].x).toBeCloseTo(2.5, 0);
    expect(buf.size).toBe(4);
  });

  it('returns an empty frame before any snapshot', () => {
    expect(new SnapshotBuffer().sample('a', 0, 100)).toEqual({
      serverTime: 0,
      enemies: [],
      projectiles: [],
      beams: [],
      mines: [],
    });
  });
});
