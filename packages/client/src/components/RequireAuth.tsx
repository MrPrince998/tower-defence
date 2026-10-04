'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, token } = useAuthStore();
  useEffect(() => {
    if (hydrated && !token) router.replace('/login');
  }, [hydrated, token, router]);
  if (!hydrated || !token) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  return <>{children}</>;
}
