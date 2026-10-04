# Phase 4 — Towers and Combat

**Required reading:** `05-GAME-DESIGN.md`, `06-ALGORITHMS.md` (sections 5-9)
**Goal:** All five tower types, projectiles, damage, armor, slow, splash, support aura, economy, upgrades.

## Deliverables
- Config files for towers and enemies (`shared/src/config`)
- Systems: `TargetingSystem`, `FiringSystem`, `ProjectileSystem`, `StatusSystem`, `AuraSystem`, `EconomySystem`
- Spatial hash grid
- Commands: `upgradeTower`, `setTargetMode`
- Enemy types: grunt, runner, tank, flyer (boss stub)
- Events: `enemy_killed`, `enemy_leaked`, `tower_upgraded`

## Tasks
1. Spatial hash rebuilt per tick; range queries return candidates.
2. Targeting modes (first/last/strongest/closest) with retarget rules.
3. Firing cooldown and projectile spawn; homing projectile hit resolution.
4. Damage formula `max(1, dmg - armor)`; cannon splash (ground only); frost slow.
5. Support aura (non-stacking) applied to damage and range.
6. Gold reward on kill; upgrade cost and stat scaling; sell refund includes upgrades.
7. Flyers move straight to goal and are ignored by cannon.

## Acceptance criteria (tests)
- Armor reduces damage but minimum damage is 1
- Frost slow refreshes and does not stack
- Cannon splash hits multiple ground enemies, not flyers
- Support aura buffs neighbors but two supports don't stack
- Upgrade cost/stats match `05-GAME-DESIGN.md`
- Performance test: 300 enemies and 40 towers, `update` averages under 5 ms

## Pitfalls
- Remove dead enemies after all systems run, not mid-iteration
- Projectiles targeting dead enemies must not crash

## Prompt
> Read CLAUDE.md and docs/phases/PHASE-04-TOWERS-AND-COMBAT.md with required reading. Phase 4 only; tests first.
