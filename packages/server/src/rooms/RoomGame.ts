import {
  GAME,
  type CommandResult,
  type Difficulty,
  type GameCommand,
  type GameEvent,
  type GameMode,
  type MatchEvent,
  type GameOverPayload,
  type MapData,
  type Snapshot,
} from '@maze/shared';
import { MatchSimulation } from '@maze/simulation';
import { GameLoop, realClock, type LoopClock } from '../loop/GameLoop';
import type { Metrics } from '../metrics';
import { SnapshotEncoder } from './snapshotEncoder';

export interface RoomGameOptions {
  mode: GameMode;
  names: Record<string, string>;
  map: MapData;
  difficulty: Difficulty;
  seed: number;
  players: string[];
  onSnapshot: (s: Snapshot) => void;
  onEvent: (e: MatchEvent) => void;
  onGameOver: (p: GameOverPayload) => void;
  clock?: LoopClock;
  metrics?: Metrics;
}

const TOWER_EVENTS = new Set<GameEvent['t']>(['tower_built', 'tower_upgraded', 'tower_sold', 'tower_target']);

/** One running MatchSimulation plus its fixed-timestep loop and network encoding. */
export class RoomGame {
  readonly sim: MatchSimulation;
  readonly loop: GameLoop;
  readonly startedAt = new Date();
  private readonly encoder = new SnapshotEncoder();
  private finished = false;

  constructor(private readonly opts: RoomGameOptions) {
    this.sim = new MatchSimulation({
      mode: opts.mode,
      map: opts.map,
      seed: opts.seed,
      difficulty: opts.difficulty,
      players: opts.players,
    });
    this.loop = new GameLoop(() => this.tick(), opts.clock ?? realClock);
  }

  get names(): Record<string, string> {
    return this.opts.names;
  }

  get seed(): number {
    return this.opts.seed;
  }

  start(): void {
    if (!this.finished) this.loop.start();
  }

  pause(): void {
    this.loop.stop();
  }

  stop(): void {
    this.finished = true;
    this.loop.stop();
  }

  /** Commands are queued and drained at the start of the next tick — never applied from socket callbacks. */
  enqueue(userId: string, cmd: GameCommand, ack: (r: CommandResult) => void): void {
    this.sim.enqueue(userId, cmd, ack);
  }

  fullSnapshot(): Snapshot {
    return this.sim.getSnapshot();
  }

  tick(): void {
    const t0 = performance.now();
    this.sim.update(GAME.DT);
    for (const e of this.sim.drainEvents()) {
      if (TOWER_EVENTS.has(e.event.t)) this.encoder.markTowersDirty(e.board);
      this.opts.onEvent(e);
    }
    if (this.sim.tick % GAME.SNAPSHOT_EVERY_TICKS === 0 || this.sim.isOver) {
      this.opts.onSnapshot(this.encoder.encode(this.sim.getSnapshot()));
    }
    this.opts.metrics?.recordTick(performance.now() - t0);
    if (this.sim.isOver && !this.finished) {
      this.stop();
      this.opts.onGameOver(this.sim.getGameOver()!);
    }
  }
}
