/** Seeded PRNG (06-ALGORITHMS.md §10). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  float(): number {
    return this.next();
  }

  /** Pick an item with probability proportional to its weight. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, it) => sum + weight(it), 0);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= weight(it);
      if (roll < 0) return it;
    }
    return items[items.length - 1];
  }
}
