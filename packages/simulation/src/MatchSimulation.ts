import {
  GAME,
  SENDS,
  VERSUS,
  type BoardSnapshot,
  type CommandResult,
  type Difficulty,
  type GameCommand,
  type GameMode,
  type GameOverPayload,
  type MapData,
  type MatchEvent,
  type PlayerStats,
  type SendType,
  type Snapshot,
} from '@maze/shared';
import { GameSimulation } from './GameSimulation';

export interface MatchOptions {
  mode: GameMode;
  map: MapData;
  seed: number;
  /** Solo only; versus always plays on 'normal' enemy HP. */
  difficulty?: Difficulty;
  /** Seat order. Solo: exactly one player. Versus: 2+. */
  players: string[];
}

interface QueuedCommand {
  playerId: string;
  cmd: GameCommand;
  onResult?: (res: CommandResult) => void;
}

/**
 * A whole match: one board (solo) or one board per player (versus). Pure and deterministic like GameSimulation.
 * Versus boards share the seed, so every player faces identical base waves; the difference comes from what
 * opponents send.
 */
export class MatchSimulation {
  readonly mode: GameMode;
  readonly players: readonly string[];
  readonly boards = new Map<string, GameSimulation>();
  private readonly queue: QueuedCommand[] = [];
  private events: MatchEvent[] = [];
  private readonly placements = new Map<string, number>();
  private tickCount = 0;
  private finished = false;

  constructor(opts: MatchOptions) {
    if (opts.players.length === 0) throw new Error('match needs at least one player');
    this.mode = opts.mode;
    this.players = [...opts.players];
    for (const id of this.players) {
      const board =
        opts.mode === 'solo'
          ? new GameSimulation({ map: opts.map, seed: opts.seed, difficulty: opts.difficulty, players: [id] })
          : new GameSimulation({
              map: opts.map,
              seed: opts.seed,
              difficulty: 'normal',
              players: [id],
              waveMode: 'timed',
              waveIntervalSec: VERSUS.WAVE_INTERVAL_SEC,
              firstBuildSec: VERSUS.FIRST_BUILD_SEC,
              startGold: VERSUS.START_GOLD,
              baseHp: VERSUS.BASE_HP,
              income: VERSUS.BASE_INCOME,
              sendIntervalSec: VERSUS.SEND_SPAWN_INTERVAL_SEC,
            });
      this.boards.set(id, board);
    }
  }

  // ---------------------------------------------------------------- loop

  enqueue(playerId: string, cmd: GameCommand, onResult?: (res: CommandResult) => void): void {
    this.queue.push({ playerId, cmd, onResult });
  }

  update(dt: number = GAME.DT): void {
    for (const q of this.queue.splice(0)) q.onResult?.(this.applyCommand(q.playerId, q.cmd));
    if (this.finished) return;
    this.tickCount++;
    for (const [id, board] of this.boards) {
      if (this.placements.has(id)) continue;
      board.update(dt);
      for (const event of board.drainEvents()) this.events.push({ board: id, event });
    }
    this.resolveEliminations();
  }

  // ---------------------------------------------------------------- commands

  applyCommand(playerId: string, cmd: GameCommand): CommandResult {
    const board = this.boards.get(playerId);
    if (!board) return { ok: false, code: 'NOT_IN_ROOM' };
    if (this.finished) return { ok: false, code: 'GAME_NOT_RUNNING' };
    if (this.placements.has(playerId)) return { ok: false, code: 'ELIMINATED' };
    if (cmd.kind === 'send') return this.send(playerId, cmd.type, cmd.target);
    return board.applyCommand(playerId, cmd);
  }

  /** Spend gold to push an enemy onto an opponent's board; raises the sender's income permanently. */
  send(from: string, type: SendType, target?: string): CommandResult {
    if (this.mode !== 'versus') return { ok: false, code: 'NOT_AVAILABLE' };
    const sender = this.boards.get(from)!;
    if (sender.wave === 0) return { ok: false, code: 'NOT_AVAILABLE' }; // not during the opening build phase
    const to = target ?? this.nextOpponent(from);
    if (!to || to === from || !this.boards.has(to) || this.placements.has(to))
      return { ok: false, code: 'INVALID_TARGET' };
    const cfg = SENDS[type];
    if (sender.gold < cfg.cost) return { ok: false, code: 'NOT_ENOUGH_GOLD' };
    const receiver = this.boards.get(to)!;
    if (!receiver.receiveSend(type, VERSUS.MAX_PENDING_SENDS)) return { ok: false, code: 'SEND_QUEUE_FULL' };
    sender.trySpend(cfg.cost);
    sender.addIncome(cfg.income);
    sender.recordSend(from, cfg.cost);
    const event = { t: 'enemy_sent' as const, from, to, type, income: sender.income };
    this.events.push({ board: to, event });
    return { ok: true };
  }

  /** Next player after `from` in seat order who is still in the game. */
  nextOpponent(from: string): string | null {
    const i = this.players.indexOf(from);
    for (let k = 1; k < this.players.length; k++) {
      const id = this.players[(i + k) % this.players.length];
      if (!this.placements.has(id)) return id;
    }
    return null;
  }

  /** Player left or timed out: solo ends the game, versus knocks the board out. */
  forfeit(playerId: string): void {
    const board = this.boards.get(playerId);
    if (!board || this.finished || this.placements.has(playerId)) return;
    board.forfeit();
    this.resolveEliminations();
  }

  private resolveEliminations(): void {
    const out = this.players.filter((id) => !this.placements.has(id) && this.boards.get(id)!.isOver);
    if (out.length === 0) return;
    if (this.mode === 'solo') {
      this.placements.set(this.players[0], 1);
      this.finished = true;
      return;
    }
    const aliveAfter = this.players.filter((id) => !this.placements.has(id)).length - out.length;
    // Simultaneous knock-outs share the same place; if nobody is left they all share 1st.
    const place = aliveAfter + 1;
    for (const id of out) {
      this.placements.set(id, place);
      this.events.push({ board: id, event: { t: 'player_eliminated', userId: id, placement: place } });
    }
    if (aliveAfter <= 1) {
      for (const id of this.players) {
        if (this.placements.has(id)) continue;
        this.placements.set(id, 1);
        this.events.push({ board: id, event: { t: 'player_eliminated', userId: id, placement: 1 } });
      }
      this.finished = true;
    }
  }

  // ---------------------------------------------------------------- queries

  get tick(): number {
    return this.tickCount;
  }

  get isOver(): boolean {
    return this.finished;
  }

  get serverTime(): number {
    return Math.round((this.tickCount * 1000) / GAME.TICK_RATE);
  }

  isAlive(playerId: string): boolean {
    return this.boards.has(playerId) && !this.placements.has(playerId);
  }

  board(playerId: string): GameSimulation | undefined {
    return this.boards.get(playerId);
  }

  getSnapshot(): Snapshot {
    const boards: BoardSnapshot[] = this.players.map((id) => ({
      id,
      alive: !this.placements.has(id),
      placement: this.placements.get(id) ?? null,
      ...this.boards.get(id)!.getSnapshot(),
    }));
    return { tick: this.tickCount, serverTime: this.serverTime, mode: this.mode, boards };
  }

  drainEvents(): MatchEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  getStats(): PlayerStats[] {
    return this.players.map((id) => {
      const s = this.boards
        .get(id)!
        .getStats()
        .find((x) => x.userId === id)!;
      return { ...s, placement: this.mode === 'versus' ? (this.placements.get(id) ?? null) : null };
    });
  }

  getGameOver(): GameOverPayload | null {
    if (!this.finished) return null;
    const waves = Math.max(...this.players.map((id) => this.boards.get(id)!.wave));
    const durationSec = Math.floor(this.tickCount * GAME.DT);
    if (this.mode === 'solo') {
      const over = this.boards.get(this.players[0])!.getGameOver();
      return {
        mode: 'solo',
        result: over?.result ?? 'lose',
        winners: [],
        wavesReached: waves,
        durationSec,
        stats: this.getStats(),
      };
    }
    return {
      mode: 'versus',
      result: 'win',
      winners: this.players.filter((id) => this.placements.get(id) === 1),
      wavesReached: waves,
      durationSec,
      stats: this.getStats(),
    };
  }
}
