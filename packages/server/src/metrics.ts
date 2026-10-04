import { logger } from './logger';

const ALERT_TICK_MS = 10;

/** Process-wide gauges exposed on /health. */
export class Metrics {
  private avgTick = 0;
  private lastAlert = 0;
  rooms = 0;
  players = 0;

  recordTick(ms: number, now = Date.now()): void {
    this.avgTick = this.avgTick === 0 ? ms : this.avgTick * 0.98 + ms * 0.02;
    if (this.avgTick > ALERT_TICK_MS && now - this.lastAlert > 10_000) {
      this.lastAlert = now;
      logger.warn({ avgTickMs: this.avgTick }, 'average tick time above 10 ms');
    }
  }

  get avgTickMs(): number {
    return Math.round(this.avgTick * 1000) / 1000;
  }
}
