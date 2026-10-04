import { GAME } from '@maze/shared';

export interface LoopClock {
  now(): number; // ms
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const realClock: LoopClock = {
  now: () => performance.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as NodeJS.Timeout),
};

const MAX_ACCUMULATOR_SEC = 0.25; // avoid the spiral of death

/** Fixed-timestep accumulator loop (06-ALGORITHMS.md §13). */
export class GameLoop {
  private handle: unknown = null;
  private acc = 0;
  private last = 0;
  ticks = 0;

  constructor(
    private readonly step: () => void,
    private readonly clock: LoopClock = realClock,
    private readonly dt: number = GAME.DT,
    private readonly intervalMs = 10,
  ) {}

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.acc = 0;
    this.last = this.clock.now();
    this.handle = this.clock.setInterval(() => this.pump(), this.intervalMs);
  }

  stop(): void {
    if (this.handle === null) return;
    this.clock.clearInterval(this.handle);
    this.handle = null;
  }

  /** Advance by elapsed wall time; public so tests can drive a fake clock. */
  pump(): void {
    const now = this.clock.now();
    this.acc = Math.min(this.acc + (now - this.last) / 1000, MAX_ACCUMULATOR_SEC);
    this.last = now;
    while (this.acc >= this.dt) {
      this.acc -= this.dt;
      this.ticks++;
      this.step();
      if (this.handle === null) break; // stopped from inside step
    }
  }
}
