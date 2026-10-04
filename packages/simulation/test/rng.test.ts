import { mulberry32, Rng } from '../src';

describe('rng', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(9);
    const b = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('weighted picks follow weights and never pick zero-weight items', () => {
    const rng = new Rng(1);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++)
      counts[rng.weighted(['a', 'b', 'c'] as const, (k) => ({ a: 3, b: 1, c: 0 })[k])]++;
    expect(counts.c).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.3);
    expect(counts.a / counts.b).toBeLessThan(3.8);
    expect(rng.float()).toBeLessThan(1);
    expect(new Rng(2).weighted(['only'], () => 0)).toBe('only'); // all-zero weights fall back to the last item
  });
});
