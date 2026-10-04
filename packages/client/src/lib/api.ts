import type {
  AuthResponse,
  Difficulty,
  LeaderboardEntry,
  MatchHistoryEntry,
  ProfileStats,
  PublicUser,
  VersusLeaderboardEntry,
} from '@maze/shared';
import { SERVER_URL } from './config';
import { useAuthStore } from '@/stores/authStore';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && path === '/me') useAuthStore.getState().logout();
    throw new ApiError(res.status, (body as { error?: string }).error ?? 'REQUEST_FAILED');
  }
  return body as T;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
  login: (login: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  me: () => request<PublicUser>('/me'),
  versusLeaderboard: (offset = 0) =>
    request<{ entries: VersusLeaderboardEntry[] }>(`/leaderboard?mode=versus&limit=25&offset=${offset}`),
  leaderboard: (mapId: string, difficulty: Difficulty, offset = 0) =>
    request<{ entries: LeaderboardEntry[] }>(
      `/leaderboard?mapId=${encodeURIComponent(mapId)}&difficulty=${difficulty}&limit=25&offset=${offset}`,
    ),
  profile: (userId: string) => request<ProfileStats>(`/users/${encodeURIComponent(userId)}/profile`),
  history: (offset = 0) => request<{ matches: MatchHistoryEntry[] }>(`/me/matches?limit=20&offset=${offset}`),
};

export function describeApiError(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'NETWORK';
  const messages: Record<string, string> = {
    USER_EXISTS: 'That username or email is already taken.',
    INVALID_CREDENTIALS: 'Wrong username/email or password.',
    INVALID_PAYLOAD: 'Please check the form fields.',
    RATE_LIMITED: 'Too many attempts. Try again in a few minutes.',
    NETWORK: `Cannot reach the game server at ${SERVER_URL}.`,
  };
  return messages[code] ?? 'Something went wrong.';
}
