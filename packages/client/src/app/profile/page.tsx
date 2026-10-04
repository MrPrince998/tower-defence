'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProfileStats } from '@maze/shared';
import { RequireAuth } from '@/components/RequireAuth';
import { api, describeApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Suspense>
        <Profile />
      </Suspense>
    </RequireAuth>
  );
}

function Profile() {
  const params = useSearchParams();
  const me = useAuthStore((s) => s.user);
  const userId = params.get('id') ?? me?.id;
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    api
      .profile(userId)
      .then(setProfile)
      .catch((e) => setError(describeApiError(e)));
  }, [userId]);

  if (error) return <p className="p-10 text-center text-red-300">{error}</p>;
  if (!profile) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  const stats = [
    ['Versus wins', profile.versusWins],
    ['Versus games', profile.versusGames],
    ['Solo best wave', profile.bestWave],
    ['Solo games', profile.games],
    ['Kills', profile.kills.toLocaleString()],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="panel flex items-center gap-5 p-6">
        <div className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 text-3xl font-extrabold text-slate-900">
          {profile.user.username[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{profile.user.username}</h1>
          <p className="text-sm text-slate-400">
            Defender since {new Date(profile.user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="panel p-5 text-center">
            <div className="font-display text-3xl font-bold text-amber-300">{value}</div>
            <div className="mt-1 text-xs tracking-wide text-slate-400 uppercase">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
