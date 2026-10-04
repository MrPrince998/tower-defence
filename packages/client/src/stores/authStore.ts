import { create } from 'zustand';
import type { PublicUser } from '@maze/shared';
import { STORAGE } from '@/lib/config';
import { readJson, writeJson } from '@/lib/storage';

interface AuthState {
  token: string | null;
  user: PublicUser | null;
  hydrated: boolean;
  hydrate(): void;
  setAuth(token: string, user: PublicUser): void;
  logout(): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate() {
    const saved = readJson<{ token: string; user: PublicUser }>(STORAGE.auth);
    set({ token: saved?.token ?? null, user: saved?.user ?? null, hydrated: true });
  },
  setAuth(token, user) {
    writeJson(STORAGE.auth, { token, user });
    set({ token, user });
  },
  logout() {
    writeJson(STORAGE.auth, null);
    writeJson(STORAGE.roomId, null);
    set({ token: null, user: null });
  },
}));
