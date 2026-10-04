'use client';

import Link from 'next/link';
import { ENEMY_TYPES, TOWERS, TOWER_TYPES } from '@maze/shared';
import { EnemyIcon, TowerIcon } from '@/components/Icons';
import { useAuthStore } from '@/stores/authStore';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <section className="text-center">
        <p className="mb-3 text-sm font-semibold tracking-[0.3em] text-amber-300/80 uppercase">
          Versus tower defense · 2–4 players · or solo
        </p>
        <h1 className="font-display text-5xl font-extrabold tracking-wide text-white md:text-7xl">
          Maze{' '}
          <span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
            Defense
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          Twist the enemy path into a deadly maze, then spend gold to send monsters at your rivals. Every send
          raises your income — attack too hard and your own castle falls. Last castle standing wins.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={user ? '/lobby' : '/register'} className="btn-primary px-8 py-3 text-lg">
            {user ? 'Play now' : 'Create account'}
          </Link>
          <Link href="/leaderboard" className="btn-secondary px-6 py-3 text-lg">
            Leaderboard
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 md:grid-cols-5">
        {TOWER_TYPES.map((t) => (
          <div key={t} className="panel flex flex-col items-center p-5 text-center">
            <TowerIcon type={t} size={72} />
            <h3 className="font-display mt-2 text-lg font-bold">{TOWERS[t].name}</h3>
            <p className="text-sm text-slate-400">{TOWERS[t].description}</p>
            <p className="mt-2 text-sm font-bold text-amber-300">{TOWERS[t].cost} gold</p>
          </div>
        ))}
      </section>

      <section className="panel mt-6 flex flex-wrap items-center justify-center gap-8 p-6">
        <span className="font-display text-slate-300">Enemies:</span>
        {ENEMY_TYPES.map((e) => (
          <span key={e} className="flex items-center gap-2 capitalize text-slate-300">
            <EnemyIcon type={e} size={40} /> {e}
          </span>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          [
            'Maze it',
            'Towers block the path. Enemies always take the shortest route — make it long. You can never fully seal it.',
          ],
          [
            'Attack & defend',
            'In versus everyone gets the same waves every 30 s. Send grunts, runners, tanks and flyers to break your rivals — and watch their boards live.',
          ],
          [
            'Climb the ranks',
            'Versus wins go on the ranked ladder. Or go solo: survive 30 waves with a boss every 10th.',
          ],
        ].map(([title, text]) => (
          <div key={title} className="panel p-5">
            <h3 className="font-display text-lg font-bold text-amber-200">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
