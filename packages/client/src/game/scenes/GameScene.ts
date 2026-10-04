import * as Phaser from 'phaser';
import {
  buildBlocked,
  computeFlowField,
  ENEMIES,
  perkMods,
  TOWERS,
  towerStats,
  tracePath,
  type GameEvent,
  type MapData,
  type TowerSnap,
  type TowerType,
  type Vec2,
} from '@maze/shared';
import { play } from '@/lib/audio';
import { INTERPOLATION_DELAY_MS } from '@/lib/config';
import { commands, snapshots } from '@/lib/net';
import { canControlView, useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ENEMY_COLORS, T, TOWER_COLORS } from '../art';
import { effectBus } from '../bus';
import { previewPlacement } from '../placement';
import { pointerState } from '../pointer';
import type { RenderEnemy, RenderFrame } from '../SnapshotBuffer';

interface TowerView {
  snap: TowerSnap;
  root: Phaser.GameObjects.Container;
  turret: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Image[];
  trim?: Phaser.GameObjects.Graphics;
  badge?: Phaser.GameObjects.Container;
  angle: number;
  recoil: number;
}

interface EnemyView {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  wings?: Phaser.GameObjects.Image;
  hpBar: Phaser.GameObjects.Graphics;
  bubble?: Phaser.GameObjects.Image;
  aura?: Phaser.GameObjects.Image;
  type: RenderEnemy['type'];
  x: number;
  y: number;
  angle: number;
  hp: number;
  shield: number;
  tint: string;
  phase: number;
}

interface ProjectileView {
  img: Phaser.GameObjects.Image;
  kind: TowerType;
  x: number;
  y: number;
}

const DEPTH = {
  path: 1,
  chevrons: 2,
  hover: 3,
  mines: 4,
  towers: 10,
  enemies: 20,
  projectiles: 30,
  fx: 40,
  ui: 50,
  text: 60,
};
const ENEMY_SCALE: Record<RenderEnemy['type'], number> = {
  grunt: 1.25,
  runner: 1.2,
  tank: 1.25,
  flyer: 1.3,
  healer: 1.2,
  splitter: 1.2,
  shielded: 1.2,
  boss: 1.35,
};
const BRANCH_COLORS = { a: 0xff9d3c, b: 0x3cc8ff } as const;
/** Towers whose turret does not track targets. */
const STATIC_TURRETS = new Set<TowerType>(['frost', 'support', 'tesla', 'mines', 'barricade']);

export class GameScene extends Phaser.Scene {
  private map!: MapData;
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();
  private projectiles = new Map<number, ProjectileView>();
  private pathGfx!: Phaser.GameObjects.Graphics;
  private chevronGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Container;
  private ghostBase!: Phaser.GameObjects.Image;
  private ghostTurret!: Phaser.GameObjects.Image;
  private castle!: Phaser.GameObjects.Image;
  private flash!: Phaser.GameObjects.Rectangle;
  private paths: Vec2[][] = [];
  private lastTowersVersion = -1;
  /** Board currently rendered (own board, or an opponent's while spectating it). */
  private viewed: string | null = null;
  private killed = new Set<number>();
  private emitters!: {
    soft: Phaser.GameObjects.Particles.ParticleEmitter;
    fire: Phaser.GameObjects.Particles.ParticleEmitter;
    smoke: Phaser.GameObjects.Particles.ParticleEmitter;
    flake: Phaser.GameObjects.Particles.ParticleEmitter;
    coin: Phaser.GameObjects.Particles.ParticleEmitter;
    magic: Phaser.GameObjects.Particles.ParticleEmitter;
  };
  private floatingTexts = 0;
  private frame: RenderFrame = { serverTime: 0, enemies: [], projectiles: [], beams: [], mines: [] };
  private beamGfx!: Phaser.GameObjects.Graphics;
  private mineSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super('Game');
  }

  create(data: { map: MapData }) {
    this.map = data.map;
    const W = this.map.width * T;
    const H = this.map.height * T;
    this.add.image(0, 0, `ground_${this.map.id}`).setOrigin(0, 0);

    this.pathGfx = this.add.graphics().setDepth(DEPTH.path);
    this.beamGfx = this.add
      .graphics()
      .setDepth(DEPTH.projectiles + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.chevronGfx = this.add.graphics().setDepth(DEPTH.chevrons);
    this.hoverGfx = this.add.graphics().setDepth(DEPTH.hover);
    this.rangeGfx = this.add.graphics().setDepth(DEPTH.ui);

    for (const s of this.map.spawns) {
      const portal = this.add
        .image((s.x + 0.5) * T, (s.y + 0.5) * T, 'portal')
        .setDepth(DEPTH.path + 0.5)
        .setScale(0.8);
      this.tweens.add({ targets: portal, angle: 360, duration: 6000, repeat: -1 });
      this.tweens.add({
        targets: portal,
        scale: 0.9,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    const g = this.map.goal;
    this.castle = this.add
      .image((g.x + 0.5) * T, (g.y + 0.5) * T, 'castle')
      .setDepth(DEPTH.towers - 1)
      .setScale(0.62);
    const glow = this.add
      .image(this.castle.x, this.castle.y, 'p_soft')
      .setDepth(DEPTH.towers - 2)
      .setScale(4.5)
      .setTint(0x88c8ff)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: 0.15,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.ghost = this.add.container(0, 0).setDepth(DEPTH.ui).setVisible(false);
    this.ghostBase = this.add.image(0, 0, 'base_arrow');
    this.ghostTurret = this.add.image(0, 0, 'turret_arrow');
    this.ghost.add([this.ghostBase, this.ghostTurret]).setAlpha(0.7);

    this.flash = this.add
      .rectangle(0, 0, W, H, 0xff0000, 0)
      .setOrigin(0, 0)
      .setDepth(DEPTH.text + 1);

    const particles = (texture: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(DEPTH.fx);
    this.emitters = {
      soft: particles('p_soft', {
        speed: { min: 40, max: 160 },
        lifespan: 380,
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.9, end: 0 },
        blendMode: 'ADD',
      }),
      fire: particles('p_soft', {
        speed: { min: 60, max: 260 },
        lifespan: 500,
        scale: { start: 0.9, end: 0 },
        tint: [0xffd27a, 0xff8a3a, 0xff4a2a],
        blendMode: 'ADD',
      }),
      smoke: particles('p_soft', {
        speed: { min: 20, max: 80 },
        lifespan: 900,
        scale: { start: 0.7, end: 1.8 },
        alpha: { start: 0.45, end: 0 },
        tint: 0x555555,
      }),
      flake: particles('p_flake', {
        speed: { min: 30, max: 120 },
        lifespan: 600,
        scale: { start: 1, end: 0.2 },
        rotate: { min: 0, max: 360 },
        alpha: { start: 1, end: 0 },
      }),
      coin: particles('p_coin', {
        speed: { min: 80, max: 180 },
        angle: { min: 220, max: 320 },
        gravityY: 500,
        lifespan: 700,
        scale: { start: 1, end: 0.6 },
        alpha: { start: 1, end: 0 },
      }),
      magic: particles('p_soft', {
        speed: { min: 30, max: 140 },
        lifespan: 700,
        scale: { start: 0.5, end: 0 },
        tint: [0xfff1a8, 0xffd35c, 0xffffff],
        blendMode: 'ADD',
      }),
    };

    this.setupInput();
    this.syncTowers(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      pointerState.cell = null;
    });
  }

  // ------------------------------------------------------------------ input

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      pointerState.cell = this.cellAt(p.worldX, p.worldY);
    });
    this.input.on('pointerout', () => {
      pointerState.cell = null;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cell = this.cellAt(p.worldX, p.worldY);
      const store = useGameStore.getState();
      if (p.rightButtonDown()) {
        store.setBuildType(null);
        store.selectTower(null);
        return;
      }
      if (!cell || store.phase !== 'playing') return;
      if (store.buildType && canControlView(store)) {
        const type = store.buildType;
        void commands.place(type, cell.x, cell.y).then((ok) => {
          if (ok && !p.event.shiftKey) useGameStore.getState().setBuildType(null);
        });
        return;
      }
      const tower = this.viewTowers().find((t) => t.x === cell.x && t.y === cell.y);
      store.selectTower(tower ? tower.id : null);
    });
  }

  private cellAt(wx: number, wy: number): Vec2 | null {
    const x = Math.floor(wx / T);
    const y = Math.floor(wy / T);
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) return null;
    return { x, y };
  }

  // ------------------------------------------------------------------ frame

  override update(time: number, delta: number) {
    const now = performance.now();
    const view = useGameStore.getState().viewBoard;
    if (view !== this.viewed) this.switchBoard(view);
    this.frame = snapshots.sample(view ?? '', now, INTERPOLATION_DELAY_MS);
    for (const q of effectBus.drain(now - INTERPOLATION_DELAY_MS))
      if (q.board === this.viewed) this.onEvent(q.event);
    this.syncTowers(false);
    this.syncEnemies(delta);
    this.syncProjectiles();
    this.syncMines();
    this.drawBeams(time);
    this.aimTowers(delta);
    this.drawChevrons(time);
    this.drawOverlay();
  }

  // ------------------------------------------------------------------ towers

  private viewTowerMap(): Record<number, TowerSnap> {
    const store = useGameStore.getState();
    return (this.viewed && store.towers[this.viewed]) || {};
  }

  private viewTowers(): TowerSnap[] {
    return Object.values(this.viewTowerMap());
  }

  /** Drop every sprite of the previous board and rebuild from the newly viewed one. */
  private switchBoard(view: string | null) {
    this.viewed = view;
    for (const v of this.towers.values()) v.root.destroy();
    for (const v of this.enemies.values()) v.root.destroy();
    for (const v of this.projectiles.values()) v.img.destroy();
    this.towers.clear();
    this.enemies.clear();
    this.projectiles.clear();
    for (const m of this.mineSprites.values()) m.destroy();
    this.mineSprites.clear();
    this.killed.clear();
    this.lastTowersVersion = -1;
    this.syncTowers(true, false);
    // Castle reflects the viewed board: standing, or already fallen.
    this.tweens.killTweensOf(this.castle);
    this.flash.setFillStyle(0x000000, 0);
    const hud = view ? useGameStore.getState().boards[view] : undefined;
    if (hud && !hud.alive && hud.placement !== 1) this.castle.setAlpha(0.35).setAngle(8).setScale(0.5);
    else this.castle.setAlpha(1).setAngle(0).setScale(0.62);
  }

  private syncTowers(force: boolean, animate = true) {
    const store = useGameStore.getState();
    const towers = this.viewTowerMap();
    if (!force && store.towersVersion === this.lastTowersVersion && !this.levelsChanged(towers)) return;
    this.lastTowersVersion = store.towersVersion;
    for (const [id, view] of this.towers) {
      if (!towers[id]) {
        this.emitters.smoke.explode(8, view.root.x, view.root.y);
        view.root.destroy();
        this.towers.delete(id);
      }
    }
    for (const t of Object.values(towers)) {
      const view = this.towers.get(t.id);
      if (!view) this.towers.set(t.id, this.createTower(t, animate));
      else if (view.snap.level !== t.level || view.snap.targetMode !== t.targetMode) {
        view.snap = t;
        this.decorateLevel(view);
      }
    }
    this.rebuildPath();
  }

  private levelsChanged(towers: Record<number, TowerSnap>): boolean {
    for (const [id, v] of this.towers) {
      const t = towers[id];
      if (t && (t.level !== v.snap.level || t.targetMode !== v.snap.targetMode)) return true;
    }
    return false;
  }

  private createTower(t: TowerSnap, animate = true): TowerView {
    const root = this.add.container((t.x + 0.5) * T, (t.y + 0.5) * T).setDepth(DEPTH.towers + t.y * 0.01);
    const base = this.add.image(0, 0, `base_${t.type}`);
    const turret = this.add.image(0, 0, `turret_${t.type}`);
    const view: TowerView = { snap: t, root, turret, pips: [], angle: 0, recoil: 0 };
    root.add(base);
    if (t.type === 'support') {
      view.ring = this.add.image(0, 0, 'rune_ring').setScale(0.55).setAlpha(0.9);
      root.add(view.ring);
    }
    root.add(turret);
    if (animate) {
      root.setScale(0.2);
      this.tweens.add({ targets: root, scale: 1, duration: 260, ease: 'Back.out' });
    }
    this.decorateLevel(view);
    return view;
  }

  private decorateLevel(view: TowerView) {
    for (const p of view.pips) p.destroy();
    view.pips = [];
    view.trim?.destroy();
    view.trim = undefined;
    const lvl = view.snap.level;
    for (let i = 1; i < lvl; i++) {
      const pip = this.add.image(-20 + (i - 1) * 12, 22, 'pip');
      view.pips.push(pip);
      view.root.add(pip);
    }
    if (lvl >= 3) {
      const trim = this.add.graphics();
      trim.lineStyle(2, lvl >= 4 ? 0xffd84a : 0xd8dde6, 0.95);
      trim.strokeRoundedRect(-26, -26, 52, 52, 12);
      view.trim = trim;
      view.root.addAt(trim, 1);
    }
    view.turret.setScale(1 + (lvl - 1) * 0.06);
    view.badge?.destroy();
    view.badge = undefined;
    const branch = view.snap.branch;
    if (branch) {
      // Specialisation badge (A = orange, B = cyan) and a matching tint on the turret.
      const color = BRANCH_COLORS[branch];
      const bg = this.add.circle(0, 0, 8, color).setStrokeStyle(2, 0x111111);
      const label = this.add
        .text(0, 0, branch.toUpperCase(), {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#111',
        })
        .setOrigin(0.5);
      view.badge = this.add.container(21, -21, [bg, label]);
      view.root.add(view.badge);
      view.turret.setTint(branch === 'a' ? 0xffdcb4 : 0xbfeeff);
    } else {
      view.turret.clearTint();
    }
  }

  private aimTowers(delta: number) {
    const dt = delta / 1000;
    for (const view of this.towers.values()) {
      const t = view.snap;
      if (t.type === 'frost') view.turret.rotation += dt * 1.2;
      if (t.type === 'tesla') view.turret.rotation += dt * 2.5;
      if (t.type === 'mines') view.turret.rotation += dt * 0.4;
      if (view.ring) view.ring.rotation += dt * 0.8;
      if (STATIC_TURRETS.has(t.type)) continue;
      const range = towerStats(t.type, t.level, t.branch).range * T;
      let best: EnemyView | null = this.beamTargetOf(t.id);
      let bestD = Infinity;
      if (!best) {
        for (const e of this.enemies.values()) {
          if (TOWERS[t.type].groundOnly && e.type === 'flyer') continue;
          const d = Math.hypot(e.root.x - view.root.x, e.root.y - view.root.y);
          if (d <= range && d < bestD) {
            best = e;
            bestD = d;
          }
        }
      }
      if (best) {
        const target = Math.atan2(best.root.y - view.root.y, best.root.x - view.root.x);
        view.angle = Phaser.Math.Angle.RotateTo(view.angle, target, dt * 10);
      }
      view.recoil = Math.max(0, view.recoil - dt * 30);
      view.turret.rotation = view.angle;
      view.turret.x = -Math.cos(view.angle) * view.recoil;
      view.turret.y = -Math.sin(view.angle) * view.recoil;
    }
  }

  // ------------------------------------------------------------------ enemies

  private syncEnemies(delta: number) {
    const seen = new Set<number>();
    for (const e of this.frame.enemies) {
      seen.add(e.id);
      let view = this.enemies.get(e.id);
      if (!view) view = this.createEnemy(e);
      const px = e.x * T;
      const py = e.y * T;
      const dx = px - view.x;
      const dy = py - view.y;
      if (dx * dx + dy * dy > 0.25) {
        const target = Math.atan2(dy, dx);
        view.angle = Phaser.Math.Angle.RotateTo(view.angle, target, (delta / 1000) * 8);
      }
      view.x = px;
      view.y = py;
      view.phase += delta / 1000;
      const bob =
        e.type === 'flyer'
          ? Math.sin(view.phase * 5) * 3 - 8
          : Math.abs(Math.sin(view.phase * (e.type === 'runner' ? 16 : 9))) * -2;
      view.root.setPosition(px, py + bob);
      view.body.setRotation(view.angle);
      if (view.wings) {
        view.wings.setRotation(view.angle);
        view.wings.setScale(1, 0.55 + Math.abs(Math.sin(view.phase * 14)) * 0.5);
      }
      if (e.hp < view.hp) this.damageNumber(px, py - 20, view.hp - e.hp, e.type === 'boss');
      if (e.hp !== view.hp) {
        view.hp = e.hp;
        this.drawHpBar(view, e);
      }
      if (e.shield !== view.shield) {
        view.shield = e.shield;
        this.drawHpBar(view, e);
      }
      this.updateStatusLook(view, e, px, py);
    }
    for (const [id, view] of this.enemies) {
      if (seen.has(id)) continue;
      if (this.killed.delete(id)) this.deathEffect(view);
      view.root.destroy();
      this.enemies.delete(id);
    }
  }

  private createEnemy(e: RenderEnemy): EnemyView {
    const root = this.add
      .container(e.x * T, e.y * T)
      .setDepth(e.type === 'flyer' ? DEPTH.enemies + 5 : DEPTH.enemies);
    const scale = ENEMY_SCALE[e.type];
    let wings: Phaser.GameObjects.Image | undefined;
    if (e.type === 'flyer') {
      const shadow = this.add.image(4, 18, 'p_soft').setTint(0x000000).setAlpha(0.35).setScale(1, 0.5);
      wings = this.add.image(0, 0, 'flyer_wings').setScale(scale);
      root.add([shadow, wings]);
    }
    let aura: Phaser.GameObjects.Image | undefined;
    if (ENEMIES[e.type].heal) {
      // Healers glow with a pulsing green aura the size of their heal radius.
      aura = this.add
        .image(0, 0, 'p_soft')
        .setTint(0x5dff9a)
        .setAlpha(0.35)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale((ENEMIES[e.type].heal!.radius * T * 2) / 32);
      root.add(aura);
      this.tweens.add({ targets: aura, alpha: 0.1, duration: 500, yoyo: true, repeat: -1 });
    }
    const body = this.add.image(0, 0, `enemy_${e.type}`).setScale(scale);
    const bubble = this.add
      .image(0, 0, 'shield_bubble')
      .setScale(e.type === 'boss' ? 1.9 : 1.05)
      .setVisible(false);
    const hpBar = this.add.graphics();
    root.add([body, bubble, hpBar]);
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 200 });
    const view: EnemyView = {
      root,
      body,
      wings,
      hpBar,
      bubble,
      aura,
      type: e.type,
      x: e.x * T,
      y: e.y * T,
      angle: 0,
      hp: e.hp,
      shield: e.shield,
      tint: '',
      phase: Math.random() * 10,
    };
    this.drawHpBar(view, e);
    if (e.type === 'boss') this.cameras.main.shake(300, 0.004);
    this.enemies.set(e.id, view);
    return view;
  }

  private drawHpBar(view: EnemyView, e: RenderEnemy) {
    const g = view.hpBar;
    g.clear();
    view.bubble?.setVisible(e.shield > 0);
    view.bubble?.setAlpha(0.35 + 0.65 * (e.maxShield ? e.shield / e.maxShield : 0));
    const hasShield = e.maxShield > 0 && e.shield > 0;
    if (e.hp >= e.maxHp && !hasShield) return;
    const w = e.type === 'boss' ? 64 : 34;
    const y = e.type === 'boss' ? -48 : e.type === 'flyer' ? -26 : -28;
    const frac = Math.max(0, e.hp / e.maxHp);
    g.fillStyle(0x000000, 0.6).fillRoundedRect(-w / 2 - 1, y - 1, w + 2, 7, 3);
    const color = frac > 0.6 ? 0x5ee05e : frac > 0.3 ? 0xf5c542 : 0xf0503c;
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, y, Math.max(2, w * frac), 5, 2);
    if (hasShield) {
      // Shield bar sits on top of the health bar.
      g.fillStyle(0x000000, 0.6).fillRoundedRect(-w / 2 - 1, y - 7, w + 2, 6, 3);
      g.fillStyle(0x6fb6ff, 1).fillRoundedRect(
        -w / 2,
        y - 6,
        Math.max(2, (w * e.shield) / e.maxShield),
        4,
        2,
      );
    }
  }

  /** Tint and particles for slow / stun / burn. */
  private updateStatusLook(view: EnemyView, e: RenderEnemy, px: number, py: number) {
    const tint = e.stunned ? 'stun' : e.burning ? 'burn' : e.slowed ? 'slow' : '';
    if (tint !== view.tint) {
      view.tint = tint;
      if (tint === 'stun') view.body.setTint(0xfff27a);
      else if (tint === 'burn') view.body.setTint(0xffa060);
      else if (tint === 'slow') view.body.setTint(0x9fdcff);
      else view.body.clearTint();
    }
    if (e.slowed && Math.random() < 0.05) this.emitters.flake.explode(1, px, py);
    if (e.burning && Math.random() < 0.25)
      this.emitters.fire.explode(1, px + (Math.random() - 0.5) * 16, py - 6);
    if (e.stunned && Math.random() < 0.12) {
      this.emitters.soft.setParticleTint(0xfff27a);
      this.emitters.soft.explode(1, px, py - 22);
    }
  }

  private deathEffect(view: EnemyView) {
    const color = Phaser.Display.Color.HexStringToColor(ENEMY_COLORS[view.type]).color;
    const big = view.type === 'boss' || view.type === 'tank';
    this.emitters.soft.setParticleTint(color);
    this.emitters.soft.explode(big ? 30 : 12, view.x, view.y);
    this.emitters.smoke.explode(big ? 10 : 4, view.x, view.y);
    this.emitters.coin.explode(big ? 6 : 2, view.x, view.y);
    if (view.type === 'boss') {
      this.emitters.fire.explode(60, view.x, view.y);
      this.cameras.main.shake(400, 0.01);
      play('explosion');
    }
    play('coin');
  }

  private damageNumber(x: number, y: number, amount: number, big: boolean) {
    if (this.floatingTexts > 40 || amount < 1) return;
    this.floatingTexts++;
    const txt = this.add
      .text(x + (Math.random() - 0.5) * 16, y, `${Math.round(amount)}`, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: big ? '22px' : '16px',
        fontStyle: 'bold',
        color: big ? '#ffd84a' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    this.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.out',
      onComplete: () => {
        txt.destroy();
        this.floatingTexts--;
      },
    });
  }

  // ------------------------------------------------------------------ projectiles

  private syncProjectiles() {
    const seen = new Set<number>();
    for (const p of this.frame.projectiles) {
      seen.add(p.id);
      const px = p.x * T;
      const py = p.y * T;
      let view = this.projectiles.get(p.id);
      if (!view) {
        const img = this.add.image(px, py, `proj_${p.kind}`).setDepth(DEPTH.projectiles);
        if (p.kind === 'frost' || p.kind === 'sniper') img.setBlendMode(Phaser.BlendModes.ADD);
        view = { img, kind: p.kind, x: px, y: py };
        this.projectiles.set(p.id, view);
        this.onFire(p.kind, px, py);
      }
      const dx = px - view.x;
      const dy = py - view.y;
      if (dx * dx + dy * dy > 0.01) view.img.setRotation(Math.atan2(dy, dx));
      if (p.kind === 'cannon') view.img.rotation += 0.3;
      view.x = px;
      view.y = py;
      view.img.setPosition(px, py);
    }
    for (const [id, view] of this.projectiles) {
      if (seen.has(id)) continue;
      this.onImpact(view);
      view.img.destroy();
      this.projectiles.delete(id);
    }
  }

  private onFire(kind: TowerType, px: number, py: number) {
    let best: TowerView | null = null;
    let bestD = T * 0.9;
    for (const v of this.towers.values()) {
      if (v.snap.type !== kind) continue;
      const d = Math.hypot(v.root.x - px, v.root.y - py);
      if (d < bestD) {
        best = v;
        bestD = d;
      }
    }
    if (best) {
      best.recoil = kind === 'cannon' ? 7 : kind === 'sniper' ? 5 : 3;
      const mx = best.root.x + Math.cos(best.angle) * 26;
      const my = best.root.y + Math.sin(best.angle) * 26;
      if (kind === 'cannon' || kind === 'sniper') {
        this.emitters.fire.explode(kind === 'cannon' ? 6 : 3, mx, my);
        this.emitters.smoke.explode(2, mx, my);
      }
    }
    if (kind !== 'support') play(`shoot_${kind}`);
  }

  private onImpact(view: ProjectileView) {
    switch (view.kind) {
      case 'cannon':
        this.emitters.fire.explode(18, view.x, view.y);
        this.emitters.smoke.explode(6, view.x, view.y);
        this.shockwave(view.x, view.y, TOWERS.cannon.splashRadius! * T, 0xffa040);
        play('explosion');
        break;
      case 'frost':
        this.emitters.flake.explode(8, view.x, view.y);
        play('freeze');
        break;
      case 'sniper':
        this.emitters.soft.setParticleTint(0xfff3b0);
        this.emitters.soft.explode(10, view.x, view.y);
        play('hit');
        break;
      default:
        this.emitters.soft.setParticleTint(0xffffff);
        this.emitters.soft.explode(4, view.x, view.y);
        play('hit');
    }
  }

  private shockwave(x: number, y: number, radius: number, color: number) {
    const ring = this.add
      .circle(x, y, radius, color, 0)
      .setStrokeStyle(4, color, 0.8)
      .setDepth(DEPTH.fx)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy(),
    });
  }

  // ------------------------------------------------------------------ server events

  private onEvent(e: GameEvent) {
    switch (e.t) {
      case 'enemy_killed':
        this.killed.add(e.id);
        this.floatText(e.x * T, e.y * T - 30, `+${e.reward}`, '#ffd84a');
        break;
      case 'enemy_leaked': {
        this.cameras.main.shake(250, 0.012);
        this.flash.setFillStyle(0xff0000, 0.25);
        this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 400 });
        this.tweens.add({ targets: this.castle, scale: 0.56, duration: 80, yoyo: true });
        this.emitters.fire.explode(20, this.castle.x, this.castle.y);
        this.floatText(this.castle.x, this.castle.y - 50, `-${e.damage} ♥`, '#ff5a4a');
        play('leak');
        break;
      }
      case 'tower_built': {
        const x = (e.tower.x + 0.5) * T;
        const y = (e.tower.y + 0.5) * T;
        this.emitters.smoke.explode(10, x, y + 10);
        break;
      }
      case 'tower_upgraded': {
        const v = this.towers.get(e.id);
        if (v) {
          this.emitters.magic.explode(24, v.root.x, v.root.y);
          this.tweens.add({ targets: v.root, scale: 1.2, duration: 120, yoyo: true });
        }
        break;
      }
      case 'tower_sold': {
        const v = this.towers.get(e.id);
        if (v) {
          this.emitters.coin.explode(8, v.root.x, v.root.y);
          this.floatText(v.root.x, v.root.y - 30, `+${e.refund}`, '#ffd84a');
        }
        break;
      }
      case 'wave_started':
        if (e.boss) {
          this.flash.setFillStyle(0x550000, 0.4);
          this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 1200 });
          this.cameras.main.shake(600, 0.006);
        }
        break;
      case 'zap':
        this.lightning(e.points);
        play('zap');
        break;
      case 'mine_exploded':
        this.emitters.fire.explode(22, e.x * T, e.y * T);
        this.emitters.smoke.explode(8, e.x * T, e.y * T);
        this.shockwave(e.x * T, e.y * T, e.radius * T, 0xff7a3a);
        this.cameras.main.shake(120, 0.004);
        play('explosion');
        break;
      case 'enemy_split':
        this.emitters.soft.setParticleTint(0xb9d84a);
        this.emitters.soft.explode(18, e.x * T, e.y * T);
        this.floatText(e.x * T, e.y * T - 24, `SPLIT ×${e.count}`, '#d8ff7a');
        break;
      case 'boss_ability':
        if (e.ability === 'summon') {
          this.emitters.magic.setParticleTint(0xb07aff);
          this.emitters.magic.explode(30, e.x * T, e.y * T);
          this.floatText(e.x * T, e.y * T - 60, 'SUMMON!', '#d4b0ff');
          this.shockwave(e.x * T, e.y * T, T * 1.4, 0xb07aff);
        } else {
          this.flash.setFillStyle(0xff0000, 0.25);
          this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 600 });
          this.cameras.main.shake(500, 0.01);
          this.floatText(e.x * T, e.y * T - 60, 'ENRAGED!', '#ff6a5a');
          play('boss');
        }
        break;
      case 'perk_chosen':
        this.emitters.magic.setParticleTint(0xffd35c);
        this.emitters.magic.explode(50, this.castle.x, this.castle.y);
        break;
      case 'wave_cleared':
        this.emitters.magic.explode(40, this.castle.x, this.castle.y);
        break;
      case 'enemy_sent':
        this.incomingMarker();
        break;
      case 'player_eliminated':
        if (e.placement > 1) this.castleFalls();
        break;
      default:
        break;
    }
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color,
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  /** Enemies sent by an opponent arrive at the portals: pulse them red and label the threat. */
  private incomingMarker() {
    for (const sp of this.map.spawns) {
      const x = (sp.x + 0.5) * T;
      const y = (sp.y + 0.5) * T;
      const ring = this.add
        .circle(x, y, T * 0.7, 0xff3b3b, 0)
        .setStrokeStyle(5, 0xff3b3b, 1)
        .setDepth(DEPTH.text)
        .setScale(0.4);
      this.tweens.add({
        targets: ring,
        scale: 1.5,
        alpha: 0,
        duration: 700,
        onComplete: () => ring.destroy(),
      });
      this.emitters.fire.explode(6, x, y);
    }
    const sp = this.map.spawns[0];
    this.floatText((sp.x + 1.6) * T, (sp.y + 0.2) * T, 'INCOMING!', '#ff6a5a');
  }

  private castleFalls() {
    this.cameras.main.shake(900, 0.02);
    this.emitters.fire.explode(80, this.castle.x, this.castle.y);
    this.emitters.smoke.explode(30, this.castle.x, this.castle.y);
    this.tweens.add({
      targets: this.castle,
      alpha: 0.35,
      angle: 8,
      scale: 0.5,
      duration: 900,
      ease: 'Cubic.in',
    });
    this.flash.setFillStyle(0x000000, 0.45);
  }

  /** Jagged lightning through the tesla chain points, fading out quickly. */
  private lightning(points: number[]) {
    const g = this.add.graphics().setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    const draw = (width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.moveTo(points[0] * T, points[1] * T);
      for (let i = 2; i < points.length; i += 2) {
        const x0 = points[i - 2] * T;
        const y0 = points[i - 1] * T;
        const x1 = points[i] * T;
        const y1 = points[i + 1] * T;
        for (let k = 1; k <= 4; k++) {
          const f = k / 4;
          const jitter = k === 4 ? 0 : (Math.random() - 0.5) * 14;
          g.lineTo(x0 + (x1 - x0) * f + jitter, y0 + (y1 - y0) * f + jitter);
        }
      }
      g.strokePath();
    };
    draw(7, 0x3d6fe0, 0.5);
    draw(3, 0xcfe2ff, 1);
    for (let i = 2; i < points.length; i += 2) {
      this.emitters.soft.setParticleTint(0xb9d4ff);
      this.emitters.soft.explode(4, points[i] * T, points[i + 1] * T);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  private beamTargetOf(towerId: number): EnemyView | null {
    const beams = this.frame.beams;
    for (let i = 0; i < beams.length; i += 2)
      if (beams[i] === towerId) return this.enemies.get(beams[i + 1]) ?? null;
    return null;
  }

  /** Laser beams: a wide red glow and a white-hot core that pulses; thicker on towers that have ramped up. */
  private drawBeams(time: number) {
    const g = this.beamGfx;
    g.clear();
    const beams = this.frame.beams;
    for (let i = 0; i < beams.length; i += 2) {
      const tower = this.towers.get(beams[i]);
      const target = this.enemies.get(beams[i + 1]);
      if (!tower || !target) continue;
      const pulse = 0.75 + Math.sin(time / 40 + i) * 0.25;
      const x0 = tower.root.x + Math.cos(tower.angle) * 24;
      const y0 = tower.root.y + Math.sin(tower.angle) * 24;
      g.lineStyle(10 * pulse, 0xff2d55, 0.25);
      g.lineBetween(x0, y0, target.root.x, target.root.y);
      g.lineStyle(4 * pulse, 0xff6b86, 0.7);
      g.lineBetween(x0, y0, target.root.x, target.root.y);
      g.lineStyle(1.5, 0xffffff, 0.95);
      g.lineBetween(x0, y0, target.root.x, target.root.y);
      if (Math.random() < 0.3) this.emitters.fire.explode(1, target.root.x, target.root.y);
    }
  }

  private syncMines() {
    const seen = new Set<string>();
    const mines = this.frame.mines;
    for (let i = 0; i < mines.length; i += 2) {
      const key = `${mines[i]},${mines[i + 1]}`;
      seen.add(key);
      if (this.mineSprites.has(key)) continue;
      const img = this.add
        .image(mines[i] * T, mines[i + 1] * T, 'mine')
        .setDepth(DEPTH.mines)
        .setScale(0.2);
      this.tweens.add({ targets: img, scale: 1, duration: 250, ease: 'Back.out' });
      this.mineSprites.set(key, img);
    }
    for (const [key, img] of this.mineSprites) {
      if (seen.has(key)) continue;
      img.destroy(); // explosion effects come from the mine_exploded event
      this.mineSprites.delete(key);
    }
  }

  // ------------------------------------------------------------------ path overlay

  private rebuildPath() {
    const towers = this.viewTowers();
    const dist = computeFlowField(
      this.map.width,
      this.map.height,
      buildBlocked(this.map, towers),
      this.map.goal,
    );
    this.paths = this.map.spawns.map((s) => tracePath(this.map, dist, s));
    const g = this.pathGfx;
    g.clear();
    for (const path of this.paths) {
      const pts = path.map((c) => new Phaser.Math.Vector2((c.x + 0.5) * T, (c.y + 0.5) * T));
      g.lineStyle(T * 0.62, 0x8a6a3a, 0.28);
      g.strokePoints(pts, false, false);
      g.lineStyle(T * 0.4, 0xc9a66b, 0.18);
      g.strokePoints(pts, false, false);
    }
  }

  private drawChevrons(time: number) {
    const g = this.chevronGfx;
    g.clear();
    if (!useSettingsStore.getState().showPath) return;
    const spacing = T * 0.8;
    const offset = ((time / 1000) * T * 1.2) % spacing;
    for (const path of this.paths) {
      let carried = offset;
      for (let i = 0; i < path.length - 1; i++) {
        const ax = (path[i].x + 0.5) * T;
        const ay = (path[i].y + 0.5) * T;
        const bx = (path[i + 1].x + 0.5) * T;
        const by = (path[i + 1].y + 0.5) * T;
        const len = Math.hypot(bx - ax, by - ay);
        const ang = Math.atan2(by - ay, bx - ax);
        for (let d = carried; d < len; d += spacing) {
          const x = ax + Math.cos(ang) * d;
          const y = ay + Math.sin(ang) * d;
          g.fillStyle(0xfff2c8, 0.55);
          const s = 7;
          g.fillTriangle(
            x + Math.cos(ang) * s,
            y + Math.sin(ang) * s,
            x + Math.cos(ang + 2.4) * s,
            y + Math.sin(ang + 2.4) * s,
            x + Math.cos(ang - 2.4) * s,
            y + Math.sin(ang - 2.4) * s,
          );
        }
        carried = (carried - len) % spacing;
        if (carried < 0) carried += spacing;
      }
    }
    // Flyers ignore the maze: faint straight line from each spawn.
    const gx = (this.map.goal.x + 0.5) * T;
    const gy = (this.map.goal.y + 0.5) * T;
    for (const s of this.map.spawns) {
      const sx = (s.x + 0.5) * T;
      const sy = (s.y + 0.5) * T;
      const len = Math.hypot(gx - sx, gy - sy);
      for (let d = offset; d < len; d += spacing * 1.5) {
        g.fillStyle(0xc9a0ff, 0.22);
        g.fillCircle(sx + ((gx - sx) * d) / len, sy + ((gy - sy) * d) / len, 3);
      }
    }
  }

  // ------------------------------------------------------------------ hover, ghost, ranges

  private drawOverlay() {
    const store = useGameStore.getState();
    const cell = pointerState.cell;
    this.hoverGfx.clear();
    this.rangeGfx.clear();
    this.ghost.setVisible(false);

    const towers = this.viewTowerMap();
    const mods = perkMods((this.viewed && store.boards[this.viewed]?.perks) || []);
    const selected = store.selectedTowerId !== null ? towers[store.selectedTowerId] : undefined;
    if (selected) {
      const x = (selected.x + 0.5) * T;
      const y = (selected.y + 0.5) * T;
      const r = towerStats(selected.type, selected.level, selected.branch, mods).range * T;
      const color = Phaser.Display.Color.HexStringToColor(TOWER_COLORS[selected.type]).color;
      this.rangeGfx.fillStyle(color, 0.1).fillCircle(x, y, r);
      this.rangeGfx.lineStyle(2, color, 0.8).strokeCircle(x, y, r);
      const pulse = 0.5 + Math.sin(this.time.now / 200) * 0.3;
      this.rangeGfx
        .lineStyle(3, 0xffffff, pulse)
        .strokeRoundedRect(x - T / 2 + 2, y - T / 2 + 2, T - 4, T - 4, 10);
    }

    if (!cell || store.phase !== 'playing') return;
    const cx = cell.x * T;
    const cy = cell.y * T;
    if (!store.buildType || !canControlView(store)) {
      this.hoverGfx.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(cx + 2, cy + 2, T - 4, T - 4, 8);
      return;
    }
    const type = store.buildType;
    const ok = previewPlacement({
      map: this.map,
      towers: Object.values(towers),
      groundEnemies: this.frame.enemies.filter((e) => e.type !== 'flyer'),
      gold: store.myId ? (store.boards[store.myId]?.gold ?? 0) : 0,
      mods,
      type,
      x: cell.x,
      y: cell.y,
    }).ok;
    const color = ok ? 0x5ee05e : 0xf0503c;
    this.hoverGfx.fillStyle(color, 0.25).fillRoundedRect(cx + 2, cy + 2, T - 4, T - 4, 8);
    this.hoverGfx.lineStyle(2, color, 0.9).strokeRoundedRect(cx + 2, cy + 2, T - 4, T - 4, 8);
    const r = towerStats(type, 1, null, mods).range * T;
    this.rangeGfx.fillStyle(color, 0.08).fillCircle(cx + T / 2, cy + T / 2, r);
    this.rangeGfx.lineStyle(2, color, 0.6).strokeCircle(cx + T / 2, cy + T / 2, r);
    this.ghostBase.setTexture(`base_${type}`);
    this.ghostTurret.setTexture(`turret_${type}`);
    this.ghost.setPosition(cx + T / 2, cy + T / 2).setVisible(true);
    if (ok) {
      this.ghostBase.clearTint();
      this.ghostTurret.clearTint();
    } else {
      this.ghostBase.setTint(0xff7070);
      this.ghostTurret.setTint(0xff7070);
    }
  }
}
