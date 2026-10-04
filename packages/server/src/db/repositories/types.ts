import type {
  Difficulty,
  GameMode,
  LeaderboardEntry,
  MatchHistoryEntry,
  PlayerStats,
  ProfileStats,
  VersusLeaderboardEntry,
} from '@maze/shared';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserRepository {
  /** Returns 'duplicate' when username or email is taken. */
  create(input: { username: string; email: string; passwordHash: string }): Promise<UserRecord | 'duplicate'>;
  findByLogin(login: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface MatchInput {
  mode: GameMode;
  mapId: string;
  difficulty: Difficulty;
  result: 'win' | 'lose';
  wavesReached: number;
  durationSec: number;
  seed: number;
  startedAt: Date;
  endedAt: Date;
  players: PlayerStats[];
}

export interface MatchRepository {
  saveMatch(input: MatchInput): Promise<string>;
  /** Solo leaderboard: waves DESC, duration ASC. */
  leaderboard(
    mapId: string,
    difficulty: Difficulty,
    limit: number,
    offset: number,
  ): Promise<LeaderboardEntry[]>;
  /** Versus ranking: wins DESC, then fewer games. */
  versusLeaderboard(limit: number, offset: number): Promise<VersusLeaderboardEntry[]>;
  profile(userId: string): Promise<ProfileStats | null>;
  history(userId: string, limit: number, offset: number): Promise<MatchHistoryEntry[]>;
}

export interface Repositories {
  kind: 'postgres' | 'memory';
  users: UserRepository;
  matches: MatchRepository;
  close(): Promise<void>;
}
