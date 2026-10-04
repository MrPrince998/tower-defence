import { ENEMIES } from '@maze/shared';
import type { World } from '../world';
import { spawnChild } from './WaveSystem';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Healers pulse-heal neighbours; bosses summon minions and enrage once below a HP threshold. */
export function updateEnemyAbilities(world: World): void {
  const count = world.enemies.length; // summons are appended; they act from next tick
  for (let i = 0; i < count; i++) {
    const e = world.enemies[i];
    if (e.hp <= 0 || e.leaked) continue;
    const cfg = ENEMIES[e.type];
    if (cfg.heal) {
      e.abilityTimer -= world.dt;
      if (e.abilityTimer <= 1e-9) {
        e.abilityTimer += cfg.heal.everySec;
        const heal = cfg.heal;
        world.hash.query(e.x, e.y, heal.radius, (o) => {
          if (o !== e && !o.leaked && o.hp > 0) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * heal.pct);
        });
      }
    }
    if (cfg.summon) {
      e.abilityTimer -= world.dt;
      if (e.abilityTimer <= 1e-9) {
        e.abilityTimer += cfg.summon.everySec;
        for (let k = 0; k < cfg.summon.count; k++) spawnChild(world, cfg.summon.type, e);
        world.events.push({ t: 'boss_ability', id: e.id, ability: 'summon', x: r2(e.x), y: r2(e.y) });
      }
    }
    if (cfg.enrage && !e.enraged && e.hp < e.maxHp * cfg.enrage.belowHpPct) {
      e.enraged = true;
      const shield = Math.round(e.maxHp * cfg.enrage.shieldPct);
      e.shield += shield;
      e.maxShield += shield;
      e.speed *= cfg.enrage.speedMult;
      world.events.push({ t: 'boss_ability', id: e.id, ability: 'enrage', x: r2(e.x), y: r2(e.y) });
    }
  }
}
