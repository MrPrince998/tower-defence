# 05 — Game Design and Balance (source of truth for numbers)

All values go into `packages/shared/src/config/{towers,enemies,waves,game}.ts`. Logic reads config; never inlines numbers.

## Global
| Key | Value |
|---|---|
| Grid | 20 x 14 cells, tile = 32 px |
| Tick rate | 20 Hz (`dt = 0.05`) |
| Snapshot rate | 10 Hz |
| Movement | 4-directional path cells; enemies move smoothly between cell centers |
| Start gold (shared team pool) | 200 |
| Base HP | 20 |
| Sell refund | 70% of total invested |
| Build phase before wave 1 | 30 s; between waves 10 s (skippable) |
| Max players | 4 |

## Towers (level 1; 3 upgrade levels)
| Type | Cost | Damage | Range (tiles) | Shots/s | Special |
|---|---|---|---|---|---|
| arrow | 50 | 8 | 3.5 | 3.0 | fast single target |
| cannon | 100 | 25 | 3.0 | 0.8 | splash radius 1.2 tiles, ground only |
| frost | 75 | 2 | 3.0 | 1.5 | slow 40% for 2 s, no stacking |
| sniper | 150 | 80 | 7.0 | 0.4 | targets strongest by default |
| support | 120 | 0 | 2.0 aura | - | +20% damage and +10% range to towers in aura (no stacking) |

Upgrade: cost = `baseCost * 1.5^level` (level 1→2 costs 1.5x base), each level: +30% damage, +10% range. Max level 4.

## Enemies
| Type | HP | Speed (tiles/s) | Armor | Reward | Notes |
|---|---|---|---|---|---|
| grunt | 40 | 1.5 | 0 | 5 | baseline |
| runner | 25 | 3.0 | 0 | 4 | fast |
| tank | 200 | 0.9 | 5 | 15 | armored |
| flyer | 50 | 2.0 | 0 | 8 | ignores maze; straight line to goal; cannon cannot hit |
| boss | 1500 | 0.8 | 8 | 150 | every 10th wave; leaks cost 10 base HP |

HP scaling per wave: `hp = baseHp * (1 + 0.12 * (wave - 1))`.
Damage formula: `dealt = max(1, damage - armor)`; slow multiplies speed by `0.6`.
Leak damage: 1 base HP per enemy (boss 10).

## Wave generator (budget based)
```
budget(w) = 20 + 12*w + w^1.5
enemy cost: grunt 10, runner 12, tank 40, flyer 25 (boss = whole wave special)
unlocks: runner from w>=3, tank from w>=5, flyer from w>=7
algorithm: while budget >= min cost: pick random affordable unlocked type (weighted, seeded RNG); subtract cost
spawn interval: 0.8 s (runners 0.5 s); spread across spawns round-robin
every 10th wave: 1 boss + 30% of normal budget
wave clear bonus gold: 20 + 2*w
```

## Difficulty modifiers
| | easy | normal | hard |
|---|---|---|---|
| enemy HP | x0.8 | x1.0 | x1.3 |
| start gold | 300 | 200 | 150 |
| base HP | 30 | 20 | 10 |

## Win/lose
- Lose: base HP <= 0
- Win (optional mode): survive wave 30. Endless mode: no win, ranked by waves reached.

## Placement rules
- Cell must be buildable and not occupied, not spawn or goal
- Tower placement must NOT make goal unreachable from any spawn (server BFS check)
- Cannot place on a cell currently occupied by a ground enemy (or push enemy: MVP rejects with `CELL_OCCUPIED`)
- Player must have enough gold

## Phase 12 additions (2026-10-01)

Numbers live in `shared/src/config/{towers,enemies,waves,perks}.ts`.

### New towers
| Type | Cost | Damage | Range | Rate | How it attacks |
|---|---|---|---|---|---|
| laser | 130 | 20/s | 3.0 | beam | continuous; ramps +0.6×/s on the same target up to ×4; armor reduces DPS (min 10%) |
| tesla | 140 | 18 | 2.6 | 0.9 | instant; chains to 3 more enemies within 1.6 tiles, −25% per jump |
| mines | 110 | 90 | 2.5 | — | lays a mine on a path cell in range every 3 s (max 4); a ground enemy triggers it: 1.0-tile blast, ground only |
| barricade | 25 | — | — | — | wall only; max level 1 |

### Level-3 branches (upgrading 2 → 3 requires choosing; fixed afterwards)
| Tower | A | B |
|---|---|---|
| arrow | Rapid Fire: +60% rate | Piercing: ignores armor, +20% damage |
| cannon | Big Blast: +50% radius, +15% damage | Napalm: burn 30% of hit damage/s for 3 s |
| frost | Deep Freeze: slow ×0.4 | Shatter: slow spreads 1.2 tiles around the target |
| sniper | Assassin: 25% chance ×3 | Marksman: +40% range, +30% rate |
| support | War Drums: aura +35% damage | Gold Mine: +15 gold every wave |
| laser | Overcharge: ramp ×2 speed and cap | Split Beam: second beam |
| tesla | Storm: +2 jumps, +10% damage | Paralyze: 30% stun for 0.7 s |
| mines | Cluster: +50% damage, +30% radius | Rapid Deploy: lay ×2 faster, +2 max |

### New enemies
| Type | HP | Speed | Armor | Reward | Budget cost | Unlock | Special |
|---|---|---|---|---|---|---|---|
| healer | 60 | 1.3 | 0 | 10 | 22 | w8 | heals others within 1.8 tiles for 6% max HP every 1 s |
| splitter | 90 | 1.2 | 0 | 6 | 24 | w11 | splits into 3 runners on death |
| shielded (Knight) | 80 | 1.1 | 2 | 9 | 26 | w13 | 70 shield (scales like HP) absorbs damage first |

Wave weights: grunt 4, runner 3, tank 2, flyer 2, healer 1.5, splitter 2, shielded 2.
Boss: summons 2 grunts every 8 s; below 50% HP enrages once (+30% max HP as shield, speed ×1.25).
Status: burn = damage over time (ignores armor), stun = cannot move, slow keeps the strongest active multiplier.

### Perks
When waves 5, 10, 15, … start, the board is offered 3 perks (seeded) and picks one; offers queue until chosen.
Lasting perks are offered only once; one-off perks can repeat.

| Perk | Effect |
|---|---|
| Sharpened | +15% tower damage |
| Eagle Eye | +10% tower range |
| Rapid Reload | +12% fire rate (and mine laying) |
| Masonry | towers and upgrades −10% cost |
| Bounty Hunter | +25% kill gold |
| Frostbite | slows last +50% |
| Interest | +10% of banked gold at every wave start (max 50) |
| War Chest | +150 gold now |
| Fortify | +5 castle HP now |

### Maps
Meadow, Canyon, **Crossroads** (3 spawns), **Fortress** (4 corner spawns, castle in the centre).
