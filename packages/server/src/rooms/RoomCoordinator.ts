import { randomInt } from 'node:crypto';
import {
  MAPS,
  ROOM,
  VERSUS,
  type Ack,
  type ChatMessage,
  type CommandResult,
  type Difficulty,
  type ErrorCode,
  type GameCommand,
  type GameMode,
  type GameOverPayload,
  type GameStartPayload,
  type RoomPlayer,
  type ServerToClientEvents,
} from '@maze/shared';
import type { LoopClock } from '../loop/GameLoop';
import type { Logger } from '../logger';
import type { Metrics } from '../metrics';
import type { MatchRepository } from '../db/repositories/types';
import { RoomGame } from './RoomGame';
import type { Room, RoomManager, UserRef } from './RoomManager';

export interface Emitter {
  toRoom<E extends keyof ServerToClientEvents>(
    roomId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
  toUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
  joinChannel(userId: string, roomId: string): void;
  leaveChannel(userId: string, roomId: string): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
};

export interface CoordinatorDeps {
  rooms: RoomManager;
  emitter: Emitter;
  matches: MatchRepository;
  logger: Logger;
  metrics?: Metrics;
  timers?: Timers;
  clock?: LoopClock;
  now?: () => number;
  /** Delay before an ended room is destroyed. */
  endedRoomTtlMs?: number;
}

const fail = (code: ErrorCode) => ({ ok: false as const, code });

/**
 * Room lifecycle: LOBBY → COUNTDOWN → RUNNING → (PAUSED) → ENDED → persisted → destroyed.
 * Owns all timers and the RoomGame instances; socket handlers only validate and delegate here.
 */
export class RoomCoordinator {
  readonly games = new Map<string, RoomGame>();
  private readonly countdowns = new Map<string, unknown>();
  private readonly pauseTimers = new Map<string, unknown>();
  private readonly endTimers = new Map<string, unknown>();
  private readonly graceTimers = new Map<string, unknown>();
  private readonly timers: Timers;
  private readonly now: () => number;

  constructor(private readonly deps: CoordinatorDeps) {
    this.timers = deps.timers ?? realTimers;
    this.now = deps.now ?? Date.now;
  }

  private get rooms() {
    return this.deps.rooms;
  }

  private broadcast(room: Room): void {
    this.deps.emitter.toRoom(room.id, 'room:state', this.rooms.toState(room));
    this.updateMetrics();
  }

  private updateMetrics(): void {
    if (!this.deps.metrics) return;
    this.deps.metrics.rooms = this.rooms.size;
    this.deps.metrics.players = this.rooms.playerCount;
  }

  /** A user may leave a finished room implicitly by creating/joining another. */
  private leaveEndedRoom(userId: string): void {
    const room = this.rooms.roomOf(userId);
    if (room?.status === 'ended') this.leave(userId);
  }

  // ------------------------------------------------------------------ lobby

  create(
    user: UserRef,
    mode: GameMode,
    mapId: string,
    difficulty: Difficulty,
  ): Ack<{ roomId: string; code: string }> {
    if (!MAPS[mapId]) return fail('INVALID_PAYLOAD');
    this.leaveEndedRoom(user.userId);
    const res = this.rooms.create(user, { mode, mapId, difficulty });
    if (!res.ok) return res;
    this.deps.emitter.joinChannel(user.userId, res.room.id);
    this.broadcast(res.room);
    // Solo games start immediately (no one to wait for).
    if (mode === 'solo') this.startGame(res.room);
    return { ok: true, roomId: res.room.id, code: res.room.code };
  }

  join(user: UserRef, code: string): Ack<{ roomId: string }> {
    this.leaveEndedRoom(user.userId);
    const res = this.rooms.join(code, user);
    if (!res.ok) return res;
    this.deps.emitter.joinChannel(user.userId, res.room.id);
    if (res.room.status === 'countdown') this.cancelCountdown(res.room);
    this.broadcast(res.room);
    return { ok: true, roomId: res.room.id };
  }

  spectate(user: UserRef, code: string): Ack<{ roomId: string }> {
    this.leaveEndedRoom(user.userId);
    const res = this.rooms.spectate(code, user);
    if (!res.ok) return res;
    this.deps.emitter.joinChannel(user.userId, res.room.id);
    this.broadcast(res.room);
    const game = this.games.get(res.room.id);
    if (game)
      this.deps.emitter.toUser(user.userId, 'game:start', this.startPayload(res.room, game, 'spectator'));
    return { ok: true, roomId: res.room.id };
  }

  leave(userId: string): Ack {
    const room = this.rooms.roomOf(userId);
    if (!room) return fail('NOT_IN_ROOM');
    this.clearGrace(userId);
    // Leaving a game in progress forfeits: versus knocks your board out, the others play on.
    const leaving = this.games.get(room.id);
    if (leaving && !this.rooms.isSpectator(room, userId)) leaving.sim.forfeit(userId);
    const res = this.rooms.leave(userId)!;
    this.deps.emitter.leaveChannel(userId, room.id);
    if (res.destroyed) {
      this.teardown(room);
    } else {
      if (room.status === 'countdown' && !this.rooms.allReady(room)) this.cancelCountdown(room);
      else if (room.status === 'lobby' && this.rooms.allReady(room)) this.startCountdown(room);
      if (room.status === 'running' && !this.rooms.anyConnected(room)) this.pause(room);
      this.broadcast(room);
    }
    this.updateMetrics();
    return { ok: true };
  }

  setReady(userId: string, ready: boolean): Ack {
    const res = this.rooms.setReady(userId, ready);
    if (!res.ok) return res;
    const room = res.room;
    if (room.status === 'lobby' && this.rooms.allReady(room)) this.startCountdown(room);
    else if (room.status === 'countdown' && !this.rooms.allReady(room)) this.cancelCountdown(room);
    this.broadcast(room);
    return { ok: true };
  }

  /** Host may start without everyone being ready. */
  forceStart(userId: string): Ack {
    const room = this.rooms.roomOf(userId);
    if (!room) return fail('NOT_IN_ROOM');
    if (room.hostId !== userId) return fail('NOT_HOST');
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    if (room.mode === 'versus' && room.players.length < VERSUS.MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS');
    this.startCountdown(room);
    this.broadcast(room);
    return { ok: true };
  }

  private startCountdown(room: Room): void {
    room.status = 'countdown';
    room.countdownEndsAt = this.now() + ROOM.COUNTDOWN_SEC * 1000;
    this.countdowns.set(
      room.id,
      this.timers.setTimeout(() => {
        this.countdowns.delete(room.id);
        if (this.rooms.get(room.id) === room && room.status === 'countdown') this.startGame(room);
      }, ROOM.COUNTDOWN_SEC * 1000),
    );
  }

  private cancelCountdown(room: Room): void {
    const t = this.countdowns.get(room.id);
    if (t !== undefined) this.timers.clearTimeout(t);
    this.countdowns.delete(room.id);
    room.status = 'lobby';
    room.countdownEndsAt = undefined;
  }

  // ------------------------------------------------------------------ game

  startGame(room: Room): RoomGame {
    const seed = randomInt(0, 2 ** 31);
    const game: RoomGame = new RoomGame({
      mode: room.mode,
      names: Object.fromEntries(room.players.map((p) => [p.userId, p.name])),
      map: MAPS[room.mapId],
      difficulty: room.difficulty,
      seed,
      players: room.players.map((p) => p.userId),
      clock: this.deps.clock,
      metrics: this.deps.metrics,
      onSnapshot: (s) => this.deps.emitter.toRoom(room.id, 'game:snapshot', s),
      onEvent: (e) => this.deps.emitter.toRoom(room.id, 'game:event', e),
      onGameOver: (p) => this.onGameOver(room, game, p),
    });
    this.games.set(room.id, game);
    room.status = 'running';
    room.countdownEndsAt = undefined;
    for (const p of room.players)
      this.deps.emitter.toUser(p.userId, 'game:start', this.startPayload(room, game, 'player'));
    for (const s of room.spectators)
      this.deps.emitter.toUser(s.userId, 'game:start', this.startPayload(room, game, 'spectator'));
    this.broadcast(room);
    game.start();
    if (!this.rooms.anyConnected(room)) this.pause(room);
    this.deps.logger.info({ roomId: room.id, code: room.code, seed }, 'game started');
    return game;
  }

  private startPayload(room: Room, game: RoomGame, role: 'player' | 'spectator'): GameStartPayload {
    return {
      map: MAPS[room.mapId],
      seed: game.seed,
      config: {
        mode: room.mode,
        difficulty: room.difficulty,
        tickRate: 20,
        snapshotRate: 10,
        tileSize: 32,
        role,
      },
      snapshot: game.fullSnapshot(),
      players: this.matchPlayers(room, game),
    };
  }

  /** Everyone who started the match, including players who have since left (their boards stay visible). */
  private matchPlayers(room: Room, game: RoomGame): RoomPlayer[] {
    return game.sim.players.map((id) => {
      const p = room.players.find((x) => x.userId === id);
      return p ? { ...p } : { userId: id, name: game.names[id] ?? '?', ready: true, connected: false };
    });
  }

  command(userId: string, cmd: GameCommand, ack: (r: CommandResult) => void): void {
    const room = this.rooms.roomOf(userId);
    if (!room) return ack(fail('NOT_IN_ROOM'));
    if (this.rooms.isSpectator(room, userId)) return ack(fail('SPECTATOR'));
    const game = this.games.get(room.id);
    if (!game || room.status !== 'running') return ack(fail('GAME_NOT_RUNNING'));
    game.enqueue(userId, cmd, ack);
  }

  chat(user: UserRef, text: string): Ack {
    const room = this.rooms.roomOf(user.userId);
    if (!room) return fail('NOT_IN_ROOM');
    const msg: ChatMessage = { userId: user.userId, name: user.name, text, at: this.now() };
    this.deps.emitter.toRoom(room.id, 'chat:message', msg);
    return { ok: true };
  }

  private onGameOver(room: Room, game: RoomGame, payload: GameOverPayload): void {
    room.status = 'ended';
    this.deps.emitter.toRoom(room.id, 'game:over', payload);
    this.broadcast(room);
    this.games.delete(room.id);
    this.clearPause(room.id);
    void this.persist(room, game, payload);
    this.endTimers.set(
      room.id,
      this.timers.setTimeout(() => this.destroy(room), this.deps.endedRoomTtlMs ?? 5 * 60_000),
    );
  }

  /** Saves the match off the tick path; retries once, never throws. */
  async persist(room: Room, game: RoomGame, payload: GameOverPayload): Promise<void> {
    if (payload.stats.length === 0) return;
    const input = {
      mode: room.mode,
      mapId: room.mapId,
      difficulty: room.difficulty,
      result: payload.result,
      wavesReached: payload.wavesReached,
      durationSec: payload.durationSec,
      seed: game.seed,
      startedAt: game.startedAt,
      endedAt: new Date(this.now()),
      players: payload.stats,
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const id = await this.deps.matches.saveMatch(input);
        this.deps.logger.info({ matchId: id, roomId: room.id }, 'match saved');
        return;
      } catch (err) {
        this.deps.logger.error({ err, attempt, roomId: room.id }, 'failed to save match');
      }
    }
  }

  // ------------------------------------------------------------------ connection lifecycle

  /** Last socket of a user went away. */
  disconnected(userId: string): void {
    const room = this.rooms.roomOf(userId);
    if (!room) return;
    if (
      this.rooms.isSpectator(room, userId) ||
      room.status === 'lobby' ||
      room.status === 'countdown' ||
      room.status === 'ended'
    ) {
      this.leave(userId);
      return;
    }
    // running / paused: reserve the slot for the grace period.
    this.rooms.setConnected(userId, false);
    this.graceTimers.set(
      userId,
      this.timers.setTimeout(() => {
        this.graceTimers.delete(userId);
        if (this.rooms.roomOf(userId) === room) this.leave(userId);
      }, ROOM.RECONNECT_GRACE_SEC * 1000),
    );
    if (room.status === 'running' && !this.rooms.anyConnected(room)) this.pause(room);
    this.broadcast(room);
  }

  /** Client asks to resume a room after a refresh or network drop; replies with full state. */
  reconnect(user: UserRef, roomId: string): Ack<{ roomId: string }> {
    const room = this.rooms.roomOf(user.userId);
    if (!room || room.id !== roomId) return fail('NOT_IN_ROOM');
    this.clearGrace(user.userId);
    this.rooms.setConnected(user.userId, true);
    this.deps.emitter.joinChannel(user.userId, room.id);
    if (room.status === 'paused') this.resume(room);
    const game = this.games.get(room.id);
    if (game) {
      const role = this.rooms.isSpectator(room, user.userId) ? 'spectator' : 'player';
      this.deps.emitter.toUser(user.userId, 'game:start', this.startPayload(room, game, role));
    }
    this.broadcast(room);
    return { ok: true, roomId: room.id };
  }

  private pause(room: Room): void {
    const game = this.games.get(room.id);
    if (!game) return;
    game.pause();
    room.status = 'paused';
    this.deps.logger.info({ roomId: room.id }, 'room paused (everyone disconnected)');
    this.pauseTimers.set(
      room.id,
      this.timers.setTimeout(() => {
        this.pauseTimers.delete(room.id);
        if (room.status === 'paused') this.destroy(room);
      }, ROOM.PAUSED_DESTROY_SEC * 1000),
    );
  }

  private resume(room: Room): void {
    this.clearPause(room.id);
    room.status = 'running';
    this.games.get(room.id)?.start();
  }

  private clearPause(roomId: string): void {
    const t = this.pauseTimers.get(roomId);
    if (t !== undefined) this.timers.clearTimeout(t);
    this.pauseTimers.delete(roomId);
  }

  private clearGrace(userId: string): void {
    const t = this.graceTimers.get(userId);
    if (t !== undefined) this.timers.clearTimeout(t);
    this.graceTimers.delete(userId);
  }

  /** Stop the game (persisting it if it was in progress) and drop all room state. */
  private teardown(room: Room): void {
    const game = this.games.get(room.id);
    if (game) {
      game.stop();
      this.games.delete(room.id);
      // Everyone is gone: forfeit whoever is still in and record the match if it got going.
      for (const id of game.sim.players) game.sim.forfeit(id);
      const over = game.sim.getGameOver();
      const started = game.sim.players.some((id) => (game.sim.board(id)?.wave ?? 0) > 0);
      if (over && started) void this.persist(room, game, over);
    }
    for (const map of [this.countdowns, this.pauseTimers, this.endTimers]) {
      const t = map.get(room.id);
      if (t !== undefined) this.timers.clearTimeout(t);
      map.delete(room.id);
    }
  }

  destroy(room: Room): void {
    for (const p of room.players) {
      this.clearGrace(p.userId);
      this.deps.emitter.leaveChannel(p.userId, room.id);
    }
    for (const s of room.spectators) this.deps.emitter.leaveChannel(s.userId, room.id);
    this.teardown(room);
    this.rooms.destroy(room.id);
    this.updateMetrics();
  }

  shutdown(): void {
    for (const game of this.games.values()) game.stop();
  }
}
