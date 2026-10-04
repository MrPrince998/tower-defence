import type { MatchEvent } from '@maze/shared';

/** Server events queued for the Phaser scene (effects are played in sync with the interpolated view). */
export interface QueuedEvent extends MatchEvent {
  receivedAt: number;
}

const queue: QueuedEvent[] = [];

export const effectBus = {
  push(e: MatchEvent, receivedAt: number) {
    queue.push({ ...e, receivedAt });
    if (queue.length > 500) queue.shift();
  },
  /** Remove and return events received before `cutoff`. */
  drain(cutoff: number): QueuedEvent[] {
    let n = 0;
    while (n < queue.length && queue[n].receivedAt <= cutoff) n++;
    return queue.splice(0, n);
  },
  clear() {
    queue.length = 0;
  },
};
