/** Token bucket: `capacity` commands, refilled continuously at `perSec`. */
export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private readonly perSec: number,
    private readonly capacity = perSec,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  allow(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSec);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
