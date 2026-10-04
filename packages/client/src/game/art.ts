/**
 * Procedural art. Every sprite is drawn with the Canvas 2D API at 64 px per tile, so the game ships
 * with no image assets and every texture stays crisp at 2x. The same functions draw React HUD icons.
 */
import { CELL, TOWER_TYPES, type EnemyType, type MapData, type TowerType } from '@maze/shared';
import {
  drawBarricade,
  drawHealer,
  drawKnight,
  drawLaserTurret,
  drawMine,
  drawMinesTurret,
  drawShieldBubble,
  drawSplitter,
  drawTeslaTurret,
} from './artExtra';

export const T = 64; // render px per tile

import { circle, ellipse, hash, linear, radial, roundRect, softShadow, type Ctx } from './artUtils';

export interface ArtDef {
  key: string;
  w: number;
  h: number;
  draw(ctx: Ctx): void;
}

export const TOWER_COLORS: Record<TowerType, string> = {
  arrow: '#e0a44a',
  cannon: '#e2603f',
  frost: '#6fdcff',
  sniper: '#9bd35a',
  support: '#ffd35c',
  laser: '#ff4d6d',
  tesla: '#7aa7ff',
  mines: '#c9a26b',
  barricade: '#a0703a',
};

export const ENEMY_COLORS: Record<EnemyType, string> = {
  grunt: '#79a843',
  runner: '#ec9433',
  tank: '#6d7f99',
  flyer: '#9a62d8',
  healer: '#4fd18b',
  splitter: '#b9d84a',
  shielded: '#8fa3c7',
  boss: '#c43a33',
};

// ------------------------------------------------------------------ towers

export function drawTowerBase(ctx: Ctx, type: TowerType) {
  if (type === 'barricade') {
    drawBarricade(ctx);
    return;
  }
  softShadow(ctx, 35, 38, 30, 26, 0.45);
  roundRect(ctx, 7, 7, 50, 50, 12);
  ctx.fillStyle = linear(ctx, 0, 7, 0, 57, [
    [0, '#a3a7b0'],
    [1, '#5a5f6b'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#2a2d35';
  ctx.lineWidth = 2;
  ctx.stroke();
  // stone blocks
  ctx.strokeStyle = 'rgba(40,42,50,0.35)';
  ctx.lineWidth = 1;
  for (const [x0, y0, x1, y1] of [
    [7, 22, 57, 22],
    [7, 42, 57, 42],
    [22, 7, 22, 22],
    [42, 22, 42, 42],
    [24, 42, 24, 57],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  roundRect(ctx, 13, 13, 38, 38, 9);
  ctx.fillStyle = linear(ctx, 0, 13, 0, 51, [
    [0, '#c7cad1'],
    [1, '#7d828e'],
  ]);
  ctx.fill();
  circle(ctx, 32, 32, 16, undefined, TOWER_COLORS[type], 3);
  circle(ctx, 32, 32, 13, 'rgba(30,32,40,0.35)');
}

export function drawTurret(ctx: Ctx, type: TowerType) {
  const c = 32;
  switch (type) {
    case 'laser':
      drawLaserTurret(ctx);
      break;
    case 'tesla':
      drawTeslaTurret(ctx);
      break;
    case 'mines':
      drawMinesTurret(ctx);
      break;
    case 'barricade':
      break; // walls have no turret
    case 'arrow': {
      softShadow(ctx, c + 2, c + 3, 18, 10, 0.3);
      roundRect(ctx, 16, 28, 30, 8, 3);
      ctx.fillStyle = linear(ctx, 0, 28, 0, 36, [
        [0, '#a8733a'],
        [1, '#5e3a17'],
      ]);
      ctx.fill();
      // bow limbs
      ctx.strokeStyle = '#4a2c10';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(34, c, 15, -1.25, 1.25);
      ctx.stroke();
      ctx.strokeStyle = '#8d5a28';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // string
      ctx.strokeStyle = '#eee7d0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(34 + 15 * Math.cos(-1.25), c + 15 * Math.sin(-1.25));
      ctx.lineTo(24, c);
      ctx.lineTo(34 + 15 * Math.cos(1.25), c + 15 * Math.sin(1.25));
      ctx.stroke();
      // bolt
      ctx.strokeStyle = '#d9d9d9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, c);
      ctx.lineTo(52, c);
      ctx.stroke();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.moveTo(56, c);
      ctx.lineTo(50, c - 3.5);
      ctx.lineTo(50, c + 3.5);
      ctx.fill();
      circle(
        ctx,
        26,
        c,
        5,
        radial(
          ctx,
          26,
          c,
          5,
          [
            [0, '#ffe39a'],
            [1, '#b0782a'],
          ],
          24,
          c - 2,
        ),
      );
      break;
    }
    case 'cannon': {
      softShadow(ctx, c + 3, c + 4, 20, 13, 0.35);
      roundRect(ctx, 28, 25, 26, 14, 3);
      ctx.fillStyle = linear(ctx, 0, 25, 0, 39, [
        [0, '#7a7f89'],
        [0.35, '#3a3e46'],
        [1, '#121418'],
      ]);
      ctx.fill();
      roundRect(ctx, 50, 23, 7, 18, 2);
      ctx.fillStyle = '#23262c';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(30, 27, 20, 2);
      circle(
        ctx,
        c,
        c,
        13,
        radial(
          ctx,
          c,
          c,
          13,
          [
            [0, '#6b707b'],
            [1, '#1b1d22'],
          ],
          c - 4,
          c - 4,
        ),
        '#101114',
        2,
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        circle(ctx, c + Math.cos(a) * 9, c + Math.sin(a) * 9, 1.3, '#c9ccd2');
      }
      circle(ctx, c, c, 4, TOWER_COLORS.cannon);
      break;
    }
    case 'frost': {
      ctx.save();
      ctx.shadowColor = '#7fe6ff';
      ctx.shadowBlur = 12;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const len = i % 2 === 0 ? 18 : 13;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, 3.5);
        ctx.closePath();
        ctx.fillStyle = linear(ctx, 0, 0, len, 0, [
          [0, 'rgba(160,235,255,0.95)'],
          [1, 'rgba(235,252,255,0.95)'],
        ]);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      circle(
        ctx,
        c,
        c,
        8,
        radial(
          ctx,
          c,
          c,
          8,
          [
            [0, '#ffffff'],
            [0.5, '#b8f1ff'],
            [1, '#3fb6e0'],
          ],
          c - 2,
          c - 2,
        ),
      );
      break;
    }
    case 'sniper': {
      softShadow(ctx, c + 3, c + 3, 22, 9, 0.3);
      roundRect(ctx, 28, 29.5, 34, 5, 2);
      ctx.fillStyle = linear(ctx, 0, 29, 0, 35, [
        [0, '#5d6b4a'],
        [1, '#232a1b'],
      ]);
      ctx.fill();
      roundRect(ctx, 58, 28.5, 5, 7, 1);
      ctx.fillStyle = '#1a1f14';
      ctx.fill();
      roundRect(ctx, 30, 21, 14, 6, 2);
      ctx.fillStyle = '#2c3324';
      ctx.fill();
      circle(
        ctx,
        44,
        24,
        2.6,
        radial(ctx, 44, 24, 3, [
          [0, '#d7ffef'],
          [1, '#2f7f69'],
        ]),
      );
      circle(
        ctx,
        c,
        c,
        11,
        radial(
          ctx,
          c,
          c,
          11,
          [
            [0, '#9fb17f'],
            [1, '#3c4a2c'],
          ],
          c - 3,
          c - 3,
        ),
        '#1e2517',
        2,
      );
      circle(ctx, c, c, 3.5, TOWER_COLORS.sniper);
      break;
    }
    case 'support': {
      ctx.save();
      ctx.shadowColor = '#ffd35c';
      ctx.shadowBlur = 16;
      circle(
        ctx,
        c,
        c,
        11,
        radial(
          ctx,
          c,
          c,
          11,
          [
            [0, '#fffbe6'],
            [0.45, '#ffe07a'],
            [1, '#d18d12'],
          ],
          c - 3,
          c - 4,
        ),
      );
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [dx, dy, r] of [
        [-4, -4, 2.2],
        [5, -2, 1.2],
      ]) {
        circle(ctx, c + dx, c + dy, r, 'rgba(255,255,255,0.85)');
      }
      break;
    }
  }
}

function drawRuneRing(ctx: Ctx) {
  const c = 48;
  ctx.strokeStyle = 'rgba(255,211,92,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  circle(ctx, c, c, 40, undefined, 'rgba(255,211,92,0.85)', 2);
  ctx.setLineDash([]);
  circle(ctx, c, c, 34, undefined, 'rgba(255,211,92,0.35)', 1.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.save();
    ctx.translate(c + Math.cos(a) * 37, c + Math.sin(a) * 37);
    ctx.rotate(a);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-1.5, -3.5, 3, 7);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ enemies (facing +x)

function drawGrunt(ctx: Ctx) {
  const c = 24;
  softShadow(ctx, c, c + 4, 16, 12, 0.4);
  // club
  ctx.strokeStyle = '#5b3a1a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c + 4, c + 11);
  ctx.lineTo(c + 17, c + 12);
  ctx.stroke();
  circle(ctx, c + 18, c + 12, 3.5, '#6e4622');
  // body + pauldrons
  circle(
    ctx,
    c - 2,
    c,
    12,
    radial(
      ctx,
      c - 2,
      c,
      12,
      [
        [0, '#9ccc5d'],
        [1, '#4d7228'],
      ],
      c - 5,
      c - 4,
    ),
    '#2e4516',
    1.5,
  );
  circle(ctx, c - 1, c - 11, 4.5, '#8a6b45', '#3b2b16', 1.2);
  circle(ctx, c - 1, c + 11, 4.5, '#8a6b45', '#3b2b16', 1.2);
  // head
  circle(
    ctx,
    c + 8,
    c,
    7.5,
    radial(
      ctx,
      c + 8,
      c,
      8,
      [
        [0, '#b7e27b'],
        [1, '#5f8c31'],
      ],
      c + 6,
      c - 3,
    ),
    '#2e4516',
    1.2,
  );
  ctx.fillStyle = '#6f9a3a';
  ctx.beginPath();
  ctx.moveTo(c + 6, c - 6);
  ctx.lineTo(c + 2, c - 13);
  ctx.lineTo(c + 10, c - 6);
  ctx.moveTo(c + 6, c + 6);
  ctx.lineTo(c + 2, c + 13);
  ctx.lineTo(c + 10, c + 6);
  ctx.fill();
  circle(ctx, c + 12, c - 2.5, 1.6, '#ff3b2f');
  circle(ctx, c + 12, c + 2.5, 1.6, '#ff3b2f');
}

function drawRunner(ctx: Ctx) {
  const c = 24;
  softShadow(ctx, c, c + 4, 17, 9, 0.4);
  // tail
  ctx.strokeStyle = '#c56c1c';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 8, c);
  ctx.quadraticCurveTo(c - 16, c - 6, c - 21, c + 2);
  ctx.stroke();
  // legs
  ctx.strokeStyle = '#8a4a12';
  ctx.lineWidth = 2.5;
  for (const [dx, dy] of [
    [-4, -1],
    [5, 1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(c + dx, c);
    ctx.lineTo(c + dx - 4, c - 10 * Math.sign(dy + 0.1));
    ctx.moveTo(c + dx, c);
    ctx.lineTo(c + dx + 3, c + 10 * Math.sign(dy + 0.1));
    ctx.stroke();
  }
  ellipse(
    ctx,
    c,
    c,
    11,
    6.5,
    radial(
      ctx,
      c,
      c,
      12,
      [
        [0, '#ffc167'],
        [1, '#d06d15'],
      ],
      c - 2,
      c - 3,
    ),
  );
  ctx.fillStyle = 'rgba(120,50,0,0.55)';
  for (const dx of [-5, 0, 5]) ctx.fillRect(c + dx - 1, c - 6, 2, 12);
  ellipse(ctx, c + 12, c, 5.5, 4.5, '#f0a347');
  circle(ctx, c + 15, c - 2, 1.4, '#1a1a1a');
  circle(ctx, c + 15, c + 2, 1.4, '#1a1a1a');
}

function drawTank(ctx: Ctx) {
  const c = 28;
  softShadow(ctx, c + 1, c + 4, 24, 19, 0.45);
  // treads
  for (const y of [c - 19, c + 11]) {
    roundRect(ctx, c - 18, y, 36, 8, 3);
    ctx.fillStyle = '#2b2f36';
    ctx.fill();
    ctx.fillStyle = '#4a505a';
    for (let x = c - 16; x < c + 16; x += 5) ctx.fillRect(x, y + 1, 2, 6);
  }
  roundRect(ctx, c - 17, c - 13, 34, 26, 9);
  ctx.fillStyle = linear(ctx, 0, c - 13, 0, c + 13, [
    [0, '#9aabc4'],
    [1, '#46546a'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#232a36';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,36,48,0.6)';
  ctx.lineWidth = 1.5;
  for (const x of [c - 6, c + 5]) {
    ctx.beginPath();
    ctx.moveTo(x, c - 12);
    ctx.lineTo(x, c + 12);
    ctx.stroke();
  }
  for (const [x, y] of [
    [c - 13, c - 9],
    [c - 13, c + 9],
    [c + 13, c - 9],
    [c + 13, c + 9],
  ]) {
    circle(ctx, x, y, 1.5, '#d8dee8');
  }
  // horn
  ctx.fillStyle = '#e9e2cf';
  ctx.beginPath();
  ctx.moveTo(c + 16, c - 4);
  ctx.lineTo(c + 26, c);
  ctx.lineTo(c + 16, c + 4);
  ctx.fill();
  circle(ctx, c + 12, c - 5, 1.8, '#ffcf3f');
  circle(ctx, c + 12, c + 5, 1.8, '#ffcf3f');
}

function drawFlyerBody(ctx: Ctx) {
  const c = 22;
  ellipse(
    ctx,
    c,
    c,
    10,
    7,
    radial(
      ctx,
      c,
      c,
      11,
      [
        [0, '#c393ff'],
        [1, '#5a2a96'],
      ],
      c - 2,
      c - 3,
    ),
  );
  circle(ctx, c + 10, c, 5.5, '#8350c7', '#3a1768', 1);
  ctx.fillStyle = '#6a3aad';
  ctx.beginPath();
  ctx.moveTo(c + 9, c - 4);
  ctx.lineTo(c + 7, c - 10);
  ctx.lineTo(c + 12, c - 5);
  ctx.moveTo(c + 9, c + 4);
  ctx.lineTo(c + 7, c + 10);
  ctx.lineTo(c + 12, c + 5);
  ctx.fill();
  circle(ctx, c + 13, c - 2, 1.4, '#ffe45c');
  circle(ctx, c + 13, c + 2, 1.4, '#ffe45c');
}

function drawFlyerWings(ctx: Ctx) {
  const c = 28;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c - 4, c);
    ctx.quadraticCurveTo(c - 10, c + s * 16, c - 2, c + s * 26);
    ctx.lineTo(c + 2, c + s * 18);
    ctx.lineTo(c + 6, c + s * 22);
    ctx.lineTo(c + 7, c + s * 12);
    ctx.lineTo(c + 12, c + s * 13);
    ctx.quadraticCurveTo(c + 8, c + s * 6, c + 4, c);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, c, 0, c + s * 26, [
      [0, 'rgba(110,60,180,0.95)'],
      [1, 'rgba(60,25,110,0.9)'],
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,10,60,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function drawBoss(ctx: Ctx) {
  const c = 44;
  softShadow(ctx, c + 2, c + 6, 36, 28, 0.5);
  // shoulder spikes
  ctx.fillStyle = '#3a2a2a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c - 10, c + s * 20);
    ctx.lineTo(c - 22, c + s * 34);
    ctx.lineTo(c + 2, c + s * 24);
    ctx.fill();
  }
  circle(
    ctx,
    c - 4,
    c,
    26,
    radial(
      ctx,
      c - 4,
      c,
      26,
      [
        [0, '#ea6a52'],
        [0.7, '#9c2620'],
        [1, '#5a1210'],
      ],
      c - 12,
      c - 8,
    ),
    '#2d0907',
    2.5,
  );
  // armor plates
  ctx.strokeStyle = 'rgba(40,10,8,0.6)';
  ctx.lineWidth = 2;
  for (const r of [12, 19]) {
    ctx.beginPath();
    ctx.arc(c - 4, c, r, -1.2, 1.2);
    ctx.stroke();
  }
  // head
  circle(
    ctx,
    c + 18,
    c,
    13,
    radial(
      ctx,
      c + 18,
      c,
      13,
      [
        [0, '#f07e62'],
        [1, '#8e221c'],
      ],
      c + 14,
      c - 5,
    ),
    '#2d0907',
    2,
  );
  // horns
  ctx.fillStyle = '#efe6d2';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + 14, c + s * 9);
    ctx.quadraticCurveTo(c + 16, c + s * 26, c + 30, c + s * 24);
    ctx.lineTo(c + 20, c + s * 10);
    ctx.fill();
  }
  // crown
  ctx.fillStyle = linear(ctx, c + 6, 0, c + 14, 0, [
    [0, '#ffe27a'],
    [1, '#c98a14'],
  ]);
  ctx.beginPath();
  ctx.moveTo(c + 8, c - 9);
  for (let i = 0; i <= 4; i++) {
    const y = c - 9 + (18 * i) / 4;
    ctx.lineTo(i % 2 === 0 ? c + 2 : c + 8, y);
  }
  ctx.lineTo(c + 12, c + 9);
  ctx.lineTo(c + 12, c - 9);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ffe45c';
  ctx.shadowBlur = 8;
  circle(ctx, c + 25, c - 4, 2.4, '#fff27a');
  circle(ctx, c + 25, c + 4, 2.4, '#fff27a');
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles & particles

function drawArrowProjectile(ctx: Ctx) {
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 5);
  ctx.lineTo(20, 5);
  ctx.stroke();
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.moveTo(26, 5);
  ctx.lineTo(19, 1.5);
  ctx.lineTo(19, 8.5);
  ctx.fill();
  ctx.fillStyle = '#e04f3a';
  ctx.beginPath();
  ctx.moveTo(1, 1.5);
  ctx.lineTo(7, 5);
  ctx.lineTo(1, 8.5);
  ctx.fill();
}

function drawCannonball(ctx: Ctx) {
  softShadow(ctx, 9, 11, 7, 5, 0.4);
  circle(
    ctx,
    9,
    9,
    6,
    radial(
      ctx,
      9,
      9,
      6,
      [
        [0, '#7c808a'],
        [1, '#101114'],
      ],
      7,
      7,
    ),
  );
}

function drawFrostShard(ctx: Ctx) {
  ctx.save();
  ctx.shadowColor = '#8feaff';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#dff9ff';
  ctx.beginPath();
  ctx.moveTo(18, 10);
  ctx.lineTo(10, 5);
  ctx.lineTo(2, 10);
  ctx.lineTo(10, 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSniperTracer(ctx: Ctx) {
  ctx.fillStyle = linear(ctx, 0, 0, 36, 0, [
    [0, 'rgba(255,240,150,0)'],
    [0.7, 'rgba(255,240,150,0.8)'],
    [1, '#ffffff'],
  ]);
  roundRect(ctx, 0, 2, 36, 4, 2);
  ctx.fill();
}

function drawSoft(ctx: Ctx, size: number) {
  const c = size / 2;
  circle(
    ctx,
    c,
    c,
    c,
    radial(ctx, c, c, c, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
}

function drawFlake(ctx: Ctx) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6);
    ctx.lineTo(8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6);
    ctx.stroke();
  }
}

function drawCoin(ctx: Ctx) {
  circle(
    ctx,
    9,
    9,
    7.5,
    radial(
      ctx,
      9,
      9,
      8,
      [
        [0, '#fff3b0'],
        [0.6, '#f5c33b'],
        [1, '#b77d0f'],
      ],
      7,
      6,
    ),
    '#8a5a07',
    1.2,
  );
  ctx.fillStyle = '#b37a10';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 9, 9.5);
}

function drawPip(ctx: Ctx) {
  ctx.fillStyle = '#ffd84a';
  ctx.strokeStyle = '#7a5200';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 6 : 2.6;
    ctx.lineTo(7 + Math.cos(a) * r, 7 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ------------------------------------------------------------------ map pieces

function drawPortal(ctx: Ctx) {
  const c = 48;
  circle(
    ctx,
    c,
    c,
    44,
    radial(ctx, c, c, 44, [
      [0, 'rgba(20,0,40,1)'],
      [0.55, 'rgba(90,30,160,0.9)'],
      [1, 'rgba(150,80,255,0)'],
    ]),
  );
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    ctx.strokeStyle = `rgba(${190 + i * 10},${120 + i * 15},255,0.75)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const a = a0 + t * 3.2;
      const r = 6 + t * 30;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  circle(
    ctx,
    c,
    c,
    7,
    radial(ctx, c, c, 7, [
      [0, '#ffffff'],
      [1, 'rgba(200,150,255,0)'],
    ]),
  );
}

function drawCastle(ctx: Ctx) {
  const s = 112;
  const c = s / 2;
  softShadow(ctx, c + 4, c + 8, 50, 44, 0.5);
  // walls
  roundRect(ctx, 14, 14, 84, 84, 8);
  ctx.fillStyle = linear(ctx, 0, 14, 0, 98, [
    [0, '#d9d2c0'],
    [1, '#8f8672'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#4a4436';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // crenellations
  ctx.fillStyle = '#b8af99';
  for (let i = 0; i < 7; i++) {
    const p = 18 + i * 12;
    for (const [x, y] of [
      [p, 10],
      [p, 94],
      [10, p],
      [94, p],
    ]) {
      ctx.fillRect(x, y, 8, 8);
      ctx.strokeStyle = '#5a5342';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, 8, 8);
    }
  }
  // courtyard
  roundRect(ctx, 26, 26, 60, 60, 6);
  ctx.fillStyle = '#7d7462';
  ctx.fill();
  // keep with roof
  roundRect(ctx, 36, 36, 40, 40, 5);
  ctx.fillStyle = linear(ctx, 36, 36, 76, 76, [
    [0, '#e25a4a'],
    [1, '#8a1f17'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#4a0f0a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(36, 36);
  ctx.lineTo(76, 76);
  ctx.moveTo(76, 36);
  ctx.lineTo(36, 76);
  ctx.stroke();
  // corner towers
  for (const [x, y] of [
    [18, 18],
    [94, 18],
    [18, 94],
    [94, 94],
  ]) {
    circle(
      ctx,
      x,
      y,
      11,
      radial(
        ctx,
        x,
        y,
        11,
        [
          [0, '#e8e1cf'],
          [1, '#8b826d'],
        ],
        x - 3,
        y - 3,
      ),
      '#4a4436',
      2,
    );
    circle(ctx, x, y, 5, '#6d6553');
  }
}

/** Full ground layer: grass with variation, flowers, boulders, spawn pads and the goal plaza. */
export function drawGround(ctx: Ctx, map: MapData) {
  const W = map.width * T;
  const H = map.height * T;
  ctx.fillStyle = '#4c8a3a';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const v = hash(x, y);
      const light = 38 + v * 8 + ((x + y) % 2 === 0 ? 2 : 0);
      ctx.fillStyle = `hsl(${100 + v * 12}, 42%, ${light}%)`;
      ctx.fillRect(x * T, y * T, T, T);
    }
  }
  // soft light patches
  for (let i = 0; i < 40; i++) {
    const px = hash(i, 7, 1) * W;
    const py = hash(i, 9, 2) * H;
    const r = 60 + hash(i, 3, 3) * 120;
    circle(
      ctx,
      px,
      py,
      r,
      radial(ctx, px, py, r, [
        [0, 'rgba(190,230,120,0.10)'],
        [1, 'rgba(190,230,120,0)'],
      ]),
    );
  }
  // grass blades
  ctx.lineCap = 'round';
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      for (let i = 0; i < 9; i++) {
        const bx = x * T + hash(x, y, i + 10) * T;
        const by = y * T + hash(x, y, i + 30) * T;
        ctx.strokeStyle = hash(x, y, i + 50) > 0.5 ? 'rgba(30,80,20,0.35)' : 'rgba(160,210,100,0.35)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (hash(x, y, i + 70) - 0.5) * 4, by - 5);
        ctx.stroke();
      }
      if (hash(x, y, 99) > 0.86) {
        const fx = x * T + 10 + hash(x, y, 101) * 44;
        const fy = y * T + 10 + hash(x, y, 102) * 44;
        const colors = ['#fff6d5', '#ffd1e8', '#ffe066', '#c9d7ff'];
        const col = colors[Math.floor(hash(x, y, 103) * colors.length)];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          circle(ctx, fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2, col);
        }
        circle(ctx, fx, fy, 1.6, '#f0a020');
      }
    }
  }
  // subtle grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= map.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * T + 0.5, 0);
    ctx.lineTo(x * T + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= map.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * T + 0.5);
    ctx.lineTo(W, y * T + 0.5);
    ctx.stroke();
  }
  // cells
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell = map.cells[y * map.width + x];
      const cx = x * T + T / 2;
      const cy = y * T + T / 2;
      if (cell === CELL.ROCK) drawBoulder(ctx, x, y, cx, cy);
      else if (cell === CELL.SPAWN) {
        circle(
          ctx,
          cx,
          cy,
          30,
          radial(ctx, cx, cy, 30, [
            [0, '#3b3450'],
            [0.8, '#57506a'],
            [1, 'rgba(60,50,80,0)'],
          ]),
        );
        circle(ctx, cx, cy, 24, undefined, 'rgba(200,170,255,0.5)', 2);
      } else if (cell === CELL.GOAL) {
        roundRect(ctx, cx - 30, cy - 30, 60, 60, 8);
        ctx.fillStyle = '#a89f8a';
        ctx.fill();
      }
    }
  }
  // vignette
  const vg = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.35,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawBoulder(ctx: Ctx, x: number, y: number, cx: number, cy: number) {
  softShadow(ctx, cx + 4, cy + 8, 30, 22, 0.45);
  const blobs = 3 + Math.floor(hash(x, y, 5) * 2);
  for (let i = 0; i < blobs; i++) {
    const ox = (hash(x, y, 200 + i) - 0.5) * 22;
    const oy = (hash(x, y, 300 + i) - 0.5) * 18;
    const r = 13 + hash(x, y, 400 + i) * 10;
    circle(
      ctx,
      cx + ox,
      cy + oy,
      r,
      radial(
        ctx,
        cx + ox,
        cy + oy,
        r,
        [
          [0, '#b9b6ad'],
          [0.7, '#7d7a72'],
          [1, '#55524c'],
        ],
        cx + ox - r / 3,
        cy + oy - r / 3,
      ),
      '#3c3a36',
      1.5,
    );
  }
  // moss
  for (let i = 0; i < 6; i++) {
    const mx = cx + (hash(x, y, 500 + i) - 0.5) * 30;
    const my = cy + (hash(x, y, 600 + i) - 0.5) * 24;
    circle(ctx, mx, my, 2 + hash(x, y, 700 + i) * 3, 'rgba(90,140,60,0.7)');
  }
}

// ------------------------------------------------------------------ registry

const ENEMY_SIZES: Record<EnemyType, number> = {
  grunt: 48,
  runner: 48,
  tank: 56,
  flyer: 44,
  healer: 48,
  splitter: 52,
  shielded: 52,
  boss: 88,
};

export const ENEMY_DRAW: Record<EnemyType, (ctx: Ctx) => void> = {
  grunt: drawGrunt,
  runner: drawRunner,
  tank: drawTank,
  flyer: drawFlyerBody,
  healer: drawHealer,
  splitter: drawSplitter,
  shielded: drawKnight,
  boss: drawBoss,
};

export function artDefinitions(): ArtDef[] {
  const defs: ArtDef[] = [];
  for (const type of TOWER_TYPES) {
    defs.push({ key: `base_${type}`, w: T, h: T, draw: (ctx) => drawTowerBase(ctx, type) });
    defs.push({ key: `turret_${type}`, w: T, h: T, draw: (ctx) => drawTurret(ctx, type) });
  }
  for (const type of Object.keys(ENEMY_DRAW) as EnemyType[]) {
    const size = ENEMY_SIZES[type];
    defs.push({ key: `enemy_${type}`, w: size, h: size, draw: ENEMY_DRAW[type] });
  }
  defs.push(
    { key: 'flyer_wings', w: 56, h: 56, draw: drawFlyerWings },
    { key: 'rune_ring', w: 96, h: 96, draw: drawRuneRing },
    { key: 'proj_arrow', w: 28, h: 10, draw: drawArrowProjectile },
    { key: 'proj_cannon', w: 18, h: 18, draw: drawCannonball },
    { key: 'proj_frost', w: 20, h: 20, draw: drawFrostShard },
    { key: 'proj_sniper', w: 36, h: 8, draw: drawSniperTracer },
    { key: 'p_soft', w: 32, h: 32, draw: (ctx) => drawSoft(ctx, 32) },
    { key: 'p_flake', w: 16, h: 16, draw: drawFlake },
    { key: 'p_coin', w: 18, h: 18, draw: drawCoin },
    { key: 'pip', w: 14, h: 14, draw: drawPip },
    { key: 'shield_bubble', w: 64, h: 64, draw: drawShieldBubble },
    { key: 'mine', w: 24, h: 24, draw: (ctx) => drawMine(ctx) },
    { key: 'portal', w: 96, h: 96, draw: drawPortal },
    { key: 'castle', w: 112, h: 112, draw: drawCastle },
  );
  return defs;
}

/** Draw a tower (base + turret) into any canvas, e.g. HUD shop icons. */
export function drawTowerIcon(ctx: Ctx, type: TowerType, size: number, level = 1) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(size / T, size / T);
  drawTowerBase(ctx, type);
  if (type === 'support') {
    ctx.save();
    ctx.translate(32 - 24, 32 - 24);
    ctx.scale(0.5, 0.5);
    drawRuneRing(ctx);
    ctx.restore();
  }
  drawTurret(ctx, type);
  for (let i = 1; i < level; i++) {
    ctx.save();
    ctx.translate(10 + (i - 1) * 12, 46);
    drawPip(ctx);
    ctx.restore();
  }
  ctx.restore();
}

export function drawEnemyIcon(ctx: Ctx, type: EnemyType, size: number) {
  ctx.clearRect(0, 0, size, size);
  const src = ENEMY_SIZES[type];
  ctx.save();
  ctx.scale(size / src, size / src);
  if (type === 'flyer') {
    ctx.save();
    ctx.translate(-6, -6);
    drawFlyerWings(ctx);
    ctx.restore();
  }
  ENEMY_DRAW[type](ctx);
  ctx.restore();
}

/** Minimap preview for the lobby. */
export function drawMiniMap(ctx: Ctx, map: MapData, cell: number) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const v = map.cells[y * map.width + x];
      ctx.fillStyle =
        v === CELL.ROCK
          ? '#77736a'
          : v === CELL.SPAWN
            ? '#8a55e0'
            : v === CELL.GOAL
              ? '#e25a4a'
              : (x + y) % 2
                ? '#4f8f3c'
                : '#56983f';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}
