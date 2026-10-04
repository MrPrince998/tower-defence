'use client';

import {
  TARGET_MODES,
  TOWERS,
  TOWER_UPGRADE,
  perkMods,
  sellRefund,
  towerStats,
  upgradeCost,
  type TowerBranch,
  type TowerSnap,
  type TowerType,
} from '@maze/shared';
import { TowerIcon } from '@/components/Icons';
import { commands } from '@/lib/net';
import { canControlView, useGameStore } from '@/stores/gameStore';

/** What a tower does beyond its numbers. */
function special(type: TowerType): string | null {
  const cfg = TOWERS[type];
  switch (cfg.kind) {
    case 'beam':
      return `Damage per second, ramps up to ×${cfg.beam!.maxRamp} on one target.`;
    case 'chain':
      return `Chains to ${cfg.chain!.jumps} more enemies (−${Math.round((1 - cfg.chain!.falloff) * 100)}% per jump).`;
    case 'mines':
      return `Lays a mine every ${cfg.mines!.layEverySec}s (max ${cfg.mines!.maxMines}). Ground only.`;
    case 'aura':
      return 'Buffs towers in range. Never attacks.';
    case 'wall':
      return 'Blocks the path. Cannot be upgraded.';
    default:
      return cfg.splashRadius ? `Splash radius ${cfg.splashRadius}.` : null;
  }
}

export function TowerPanel() {
  const tower = useGameStore((s) =>
    s.selectedTowerId !== null && s.viewBoard ? s.towers[s.viewBoard]?.[s.selectedTowerId] : undefined,
  );
  const gold = useGameStore((s) => (s.myId ? (s.boards[s.myId]?.gold ?? 0) : 0));
  const perks = useGameStore((s) => (s.viewBoard ? s.boards[s.viewBoard]?.perks : undefined));
  const players = useGameStore((s) => s.players);
  const control = useGameStore(canControlView);
  if (!tower) {
    return (
      <section className="panel p-3 text-sm text-slate-500">
        <h3 className="font-display mb-1 text-sm font-bold tracking-wide text-slate-300">TOWER</h3>
        Select a tower on the map to upgrade, sell, or change its targeting.
      </section>
    );
  }
  const mods = perkMods(perks ?? []);
  const cfg = TOWERS[tower.type];
  const cost = upgradeCost(tower.type, tower.level, mods);
  const refund = sellRefund(tower.invested);
  const owner = players.find((p) => p.userId === tower.owner)?.name ?? 'someone';
  const next = tower.level < cfg.maxLevel ? tower.level + 1 : null;
  const choosingBranch = next === TOWER_UPGRADE.BRANCH_LEVEL && !!cfg.branches;
  const now = towerStats(tower.type, tower.level, tower.branch, mods);
  const after = next && !choosingBranch ? towerStats(tower.type, next, tower.branch, mods) : null;
  const branch = tower.branch ? cfg.branches?.[tower.branch] : null;
  const note = special(tower.type);

  return (
    <section className="panel p-3">
      <div className="flex items-center gap-3">
        <TowerIcon type={tower.type} size={56} level={tower.level} />
        <div>
          <div className="font-display text-lg font-bold">
            {cfg.name} <span className="text-sm text-amber-300">Lv {tower.level}</span>
          </div>
          {branch && (
            <div
              className={`text-xs font-semibold ${tower.branch === 'a' ? 'text-orange-300' : 'text-cyan-300'}`}
            >
              {branch.name} — {branch.description}
            </div>
          )}
          <div className="text-xs text-slate-400">built by {owner}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
        {cfg.damage > 0 && (
          <Row
            label={cfg.kind === 'beam' ? 'DPS' : 'Damage'}
            value={now.damage.toFixed(1)}
            next={after?.damage.toFixed(1)}
          />
        )}
        {cfg.range > 0 && <Row label="Range" value={now.range.toFixed(2)} next={after?.range.toFixed(2)} />}
        {now.rate > 0 && <Row label="Rate" value={`${now.rate.toFixed(2)}/s`} next={null} />}
      </div>
      {note && <p className="mt-1 text-[11px] text-slate-400">{note}</p>}
      {control && cfg.kind !== 'aura' && cfg.kind !== 'wall' && cfg.kind !== 'mines' && (
        <div className="mt-3">
          <div className="label">Target</div>
          <div className="grid grid-cols-4 gap-1">
            {TARGET_MODES.map((m) => (
              <button
                key={m}
                onClick={() => commands.setTarget(tower.id, m)}
                className={`rounded-lg px-1 py-1 text-xs font-semibold capitalize ${tower.targetMode === m ? 'bg-amber-400 text-slate-900' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {control && choosingBranch && cost !== null && <BranchChoice tower={tower} cost={cost} gold={gold} />}
      {control && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!choosingBranch && (
            <button
              className="btn-primary px-2 py-2 text-sm"
              disabled={cost === null || gold < cost}
              onClick={() => commands.upgrade(tower.id)}
            >
              {cost === null ? 'Max level' : `⬆ Upgrade ${cost}g`}
            </button>
          )}
          <button
            className={`btn-danger px-2 py-2 text-sm ${choosingBranch ? 'col-span-2' : ''}`}
            onClick={() => commands.sell(tower.id)}
          >
            Sell +{refund}g
          </button>
        </div>
      )}
    </section>
  );
}

/** Level 3 is a fork: pick one of two specialisations for good. */
function BranchChoice({ tower, cost, gold }: { tower: TowerSnap; cost: number; gold: number }) {
  const branches = TOWERS[tower.type].branches!;
  return (
    <div className="mt-3">
      <div className="label">Level 3 — choose a specialisation ({cost}g)</div>
      <div className="grid grid-cols-2 gap-2">
        {(['a', 'b'] as TowerBranch[]).map((b) => (
          <button
            key={b}
            disabled={gold < cost}
            onClick={() => commands.upgrade(tower.id, b)}
            className={`rounded-xl border p-2 text-left transition disabled:opacity-40 ${
              b === 'a'
                ? 'border-orange-400/40 bg-orange-500/10 hover:bg-orange-500/20'
                : 'border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20'
            }`}
          >
            <div className={`text-sm font-bold ${b === 'a' ? 'text-orange-200' : 'text-cyan-200'}`}>
              {branches[b].name}
            </div>
            <div className="text-[11px] leading-tight text-slate-300">{branches[b].description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, next }: { label: string; value: string; next: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1">
      <span className="text-slate-400">{label} </span>
      <span className="font-bold">{value}</span>
      {next && next !== value && <span className="text-emerald-300"> → {next}</span>}
    </div>
  );
}
