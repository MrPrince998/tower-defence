import { randomUUID } from 'node:crypto';
import type {
  Difficulty,
  LeaderboardEntry,
  MatchHistoryEntry,
  ProfileStats,
  VersusLeaderboardEntry,
} from '@maze/shared';
import type { MatchInput, MatchRepository, Repositories, UserRecord, UserRepository } from './types';

/** In-memory store with the same semantics as Postgres. Used for tests and DB-less local play. */
export class MemoryUserRepository implements UserRepository {
  readonly users = new Map<string, UserRecord>();

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRecord | 'duplicate'> {
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === input.username.toLowerCase() || u.email === input.email)
        return 'duplicate';
    }
    const user: UserRecord = { id: randomUUID(), ...input, createdAt: new Date() };
    this.users.set(user.id, user);
    return user;
  }

  async findByLogin(login: string): Promise<UserRecord | null> {
    const l = login.toLowerCase();
    for (const u of this.users.values()) if (u.username.toLowerCase() === l || u.email === l) return u;
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }
}

interface StoredMatch extends MatchInput {
  id: string;
}

export class MemoryMatchRepository implements MatchRepository {
  readonly matches: StoredMatch[] = [];

  constructor(private readonly users: MemoryUserRepository) {}

  async saveMatch(input: MatchInput): Promise<string> {
    const id = randomUUID();
    this.matches.push({ ...input, id, players: input.players.map((p) => ({ ...p })) });
    return id;
  }

  private names(m: StoredMatch): string[] {
    return m.players.map((p) => this.users.users.get(p.userId)?.username ?? '?').sort();
  }

  async leaderboard(
    mapId: string,
    difficulty: Difficulty,
    limit: number,
    offset: number,
  ): Promise<LeaderboardEntry[]> {
    return this.matches
      .filter((m) => m.mode === 'solo' && m.mapId === mapId && m.difficulty === difficulty)
      .sort(
        (a, b) =>
          b.wavesReached - a.wavesReached ||
          a.durationSec - b.durationSec ||
          a.endedAt.getTime() - b.endedAt.getTime(),
      )
      .slice(offset, offset + limit)
      .map((m) => ({
        id: m.id,
        wavesReached: m.wavesReached,
        durationSec: m.durationSec,
        result: m.result,
        endedAt: m.endedAt.toISOString(),
        players: this.names(m),
      }));
  }

  async versusLeaderboard(limit: number, offset: number): Promise<VersusLeaderboardEntry[]> {
    const byUser = new Map<string, VersusLeaderboardEntry>();
    for (const m of this.matches) {
      if (m.mode !== 'versus') continue;
      for (const p of m.players) {
        const e = byUser.get(p.userId) ?? {
          userId: p.userId,
          username: this.users.users.get(p.userId)?.username ?? '?',
          wins: 0,
          games: 0,
          enemiesSent: 0,
        };
        e.games += 1;
        if (p.placement === 1) e.wins += 1;
        e.enemiesSent += p.enemiesSent;
        byUser.set(p.userId, e);
      }
    }
    return [...byUser.values()]
      .sort((a, b) => b.wins - a.wins || a.games - b.games || a.username.localeCompare(b.username))
      .slice(offset, offset + limit);
  }

  async profile(userId: string): Promise<ProfileStats | null> {
    const u = this.users.users.get(userId);
    if (!u) return null;
    const mine = this.matches.filter((m) => m.players.some((p) => p.userId === userId));
    const solo = mine.filter((m) => m.mode === 'solo');
    const versus = mine.filter((m) => m.mode === 'versus');
    const stats = mine.map((m) => m.players.find((p) => p.userId === userId)!);
    return {
      user: { id: u.id, username: u.username, createdAt: u.createdAt.toISOString() },
      games: solo.length,
      wins: solo.filter((m) => m.result === 'win').length,
      kills: stats.reduce((s, p) => s + p.kills, 0),
      damageDealt: stats.reduce((s, p) => s + Math.round(p.damageDealt), 0),
      bestWave: solo.reduce((s, m) => Math.max(s, m.wavesReached), 0),
      versusGames: versus.length,
      versusWins: versus.filter((m) => m.players.find((p) => p.userId === userId)!.placement === 1).length,
    };
  }

  async history(userId: string, limit: number, offset: number): Promise<MatchHistoryEntry[]> {
    return this.matches
      .filter((m) => m.players.some((p) => p.userId === userId))
      .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
      .slice(offset, offset + limit)
      .map((m) => {
        const p = m.players.find((x) => x.userId === userId)!;
        return {
          id: m.id,
          mode: m.mode,
          placement: p.placement,
          enemiesSent: p.enemiesSent,
          mapId: m.mapId,
          difficulty: m.difficulty,
          result: m.result,
          wavesReached: m.wavesReached,
          durationSec: m.durationSec,
          endedAt: m.endedAt.toISOString(),
          kills: p.kills,
          damageDealt: Math.round(p.damageDealt),
          goldSpent: p.goldSpent,
          towersBuilt: p.towersBuilt,
          players: this.names(m),
        };
      });
  }
}

export function createMemoryRepositories(): Repositories & {
  users: MemoryUserRepository;
  matches: MemoryMatchRepository;
} {
  const users = new MemoryUserRepository();
  return { kind: 'memory', users, matches: new MemoryMatchRepository(users), close: async () => {} };
}
