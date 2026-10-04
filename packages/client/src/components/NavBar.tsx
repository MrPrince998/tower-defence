'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useLobbyStore } from '@/stores/lobbyStore';
import { useGameStore } from '@/stores/gameStore';

const LINKS = [
  { href: '/lobby', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/history', label: 'History' },
  { href: '/profile', label: 'Profile' },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const connected = useLobbyStore((s) => s.connected);
  const inGame = useGameStore((s) => s.phase === 'playing') && pathname.startsWith('/room/');
  if (inGame) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/70 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-display text-lg font-extrabold tracking-wider text-amber-300">
          MAZE<span className="text-slate-200">DEFENSE</span>
        </Link>
        {user && (
          <div className="flex gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  pathname.startsWith(l.href) ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="flex items-center gap-2 text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
                  title={connected ? 'connected' : 'offline'}
                />
                {user.username}
              </span>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  useAuthStore.getState().logout();
                  router.push('/login');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-300 hover:text-white">
                Log in
              </Link>
              <Link href="/register" className="btn-primary py-1.5 text-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
