'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { bindSocket } from '@/lib/net';
import { closeSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

/** Hydrates persisted stores and keeps one authenticated socket alive while logged in. */
export function Providers({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    useSettingsStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!token) {
      closeSocket();
      return;
    }
    bindSocket(getSocket(token));
    api.me().catch(() => {});
  }, [token]);

  return <>{children}</>;
}
