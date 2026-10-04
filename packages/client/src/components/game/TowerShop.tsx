'use client';

import { perkMods, TOWERS, TOWER_TYPES, towerCost, towerStats } from '@maze/shared';
import { TowerIcon } from '@/components/Icons';
import { canControlView, useGameStore } from '@/stores/gameStore';

export function TowerShop() {
  const gold = useGameStore((s) => (s.myId ? (s.boards[s.myId]?.gold ?? 0) : 0));
  const buildType = useGameStore((s) => s.buildType);
  const setBuildType = useGameStore((s) => s.setBuildType);
  const control = useGameStore(canControlView);
  const mods = perkMods(useGameStore((s) => (s.myId ? s.boards[s.myId]?.perks : undefined)) ?? []);
  const myId = useGameStore((s) => s.myId);
  const alive = useGameStore((s) => (s.myId ? !!s.boards[s.myId]?.alive : false));
  if (!control) {
    return (
      <section className="panel p-3 text-sm text-slate-400">
        <h3 className="font-display mb-1 text-sm font-bold tracking-wide text-slate-300">BUILD</h3>
        {alive && myId ? (
          <button
            className="btn-primary w-full py-1.5 text-sm"
            onClick={() => useGameStore.getState().setViewBoard(myId)}
          >
            ← Back to your board (Home)
          </button>
        ) : (
          'Your castle has fallen — you can still watch the others.'
        )}
      </section>
    );
  }

  return (
    <section className="panel p-3">
      <h3 className="font-display mb-2 px-1 text-sm font-bold tracking-wide text-slate-300">BUILD</h3>
      <div className="grid grid-cols-5 gap-1.5">
        {TOWER_TYPES.map((t, i) => {
          const cfg = TOWERS[t];
          const price = towerCost(t, mods);
          const affordable = gold >= price;
          const active = buildType === t;
          return (
            <button
              key={t}
              onClick={() => setBuildType(active ? null : t)}
              title={`${cfg.name} — ${cfg.description}`}
              className={`group relative flex flex-col items-center rounded-xl border p-1 pt-1.5 transition ${
                active
                  ? 'border-amber-400 bg-amber-400/15'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              } ${affordable ? '' : 'opacity-45'}`}
            >
              <span className="absolute top-0.5 left-1 text-[10px] font-bold text-slate-500">{i + 1}</span>
              <TowerIcon type={t} size={40} />
              <span className={`text-xs font-bold ${affordable ? 'text-amber-300' : 'text-red-300'}`}>
                {price}
              </span>
            </button>
          );
        })}
      </div>
      {buildType && (
        <div className="mt-2 rounded-xl bg-white/5 p-2 text-xs text-slate-300">
          <div className="font-bold text-slate-100">{TOWERS[buildType].name}</div>
          <div>{TOWERS[buildType].description}</div>
          <div className="mt-1 text-slate-400">
            {TOWERS[buildType].damage > 0 && <>DMG {TOWERS[buildType].damage} · </>}
            Range {towerStats(buildType, 1, null, mods).range.toFixed(1)}
            {TOWERS[buildType].rate > 0 && <> · {TOWERS[buildType].rate}/s</>}
          </div>
          <div className="mt-1 text-slate-500">
            Click to build · shift-click to keep building · right-click to cancel
          </div>
        </div>
      )}
    </section>
  );
}
