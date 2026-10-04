/** Procedural art for the Phase 12 towers and enemies (laser, tesla, mines, barricade; healer, splitter, knight). */
import { circle, ellipse, linear, radial, roundRect, softShadow, type Ctx } from './artUtils';

// ------------------------------------------------------------------ towers (turrets face +x, 64 px canvas)

export function drawLaserTurret(ctx: Ctx) {
  const c = 32;
  softShadow(ctx, c + 3, c + 3, 20, 11, 0.3);
  // housing
  roundRect(ctx, 22, 25, 22, 14, 5);
  ctx.fillStyle = linear(ctx, 0, 25, 0, 39, [
    [0, '#5d6173'],
    [1, '#23252f'],
  ]);
  ctx.fill();
  // barrel with cooling fins
  roundRect(ctx, 40, 28.5, 16, 7, 3);
  ctx.fillStyle = '#2b2e39';
  ctx.fill();
  ctx.fillStyle = '#6b7080';
  for (const x of [42, 46, 50]) ctx.fillRect(x, 27, 2, 10);
  // ruby lens
  ctx.save();
  ctx.shadowColor = '#ff4d6d';
  ctx.shadowBlur = 12;
  circle(
    ctx,
    57,
    c,
    4,
    radial(
      ctx,
      57,
      c,
      4,
      [
        [0, '#ffe3e8'],
        [0.5, '#ff4d6d'],
        [1, '#8a0f26'],
      ],
      56,
      c - 1,
    ),
  );
  ctx.restore();
  // core
  circle(
    ctx,
    c - 2,
    c,
    9,
    radial(
      ctx,
      c - 2,
      c,
      9,
      [
        [0, '#ff9aae'],
        [0.5, '#e02850'],
        [1, '#4d0616'],
      ],
      c - 5,
      c - 3,
    ),
    '#1a1b22',
    2,
  );
}

export function drawTeslaTurret(ctx: Ctx) {
  const c = 32;
  softShadow(ctx, c + 2, c + 3, 16, 14, 0.3);
  // copper coil rings (top-down: concentric)
  for (const [r, col] of [
    [15, '#8a4b1f'],
    [12, '#c47a3a'],
    [9, '#8a4b1f'],
  ] as const) {
    circle(ctx, c, c, r, undefined, col, 3);
  }
  ctx.strokeStyle = 'rgba(255,200,140,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 9, c + Math.sin(a) * 9);
    ctx.lineTo(c + Math.cos(a) * 15, c + Math.sin(a) * 15);
    ctx.stroke();
  }
  // energy orb
  ctx.save();
  ctx.shadowColor = '#8fb8ff';
  ctx.shadowBlur = 16;
  circle(
    ctx,
    c,
    c,
    7,
    radial(
      ctx,
      c,
      c,
      7,
      [
        [0, '#ffffff'],
        [0.4, '#b9d4ff'],
        [1, '#3d6fe0'],
      ],
      c - 2,
      c - 2,
    ),
  );
  ctx.restore();
  // little arcs
  ctx.strokeStyle = 'rgba(200,225,255,0.9)';
  ctx.lineWidth = 1.2;
  for (const a of [0.4, 2.5, 4.4]) {
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 7, c + Math.sin(a) * 7);
    ctx.lineTo(c + Math.cos(a + 0.2) * 11, c + Math.sin(a + 0.2) * 11);
    ctx.lineTo(c + Math.cos(a - 0.1) * 14, c + Math.sin(a - 0.1) * 14);
    ctx.stroke();
  }
}

export function drawMinesTurret(ctx: Ctx) {
  const c = 32;
  softShadow(ctx, c + 2, c + 3, 17, 13, 0.3);
  // ammo crate
  roundRect(ctx, 20, 21, 24, 22, 3);
  ctx.fillStyle = linear(ctx, 0, 21, 0, 43, [
    [0, '#b98a52'],
    [1, '#7a5428'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#4a3014';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, 21);
  ctx.lineTo(44, 43);
  ctx.moveTo(44, 21);
  ctx.lineTo(20, 43);
  ctx.stroke();
  // launcher tube
  roundRect(ctx, 38, 28, 16, 8, 3);
  ctx.fillStyle = '#3b3f35';
  ctx.fill();
  drawMine(ctx, 52, 32, 0.55);
}

/** Barricade: a wooden spiked palisade instead of a stone base (no turret). */
export function drawBarricade(ctx: Ctx) {
  softShadow(ctx, 34, 38, 28, 20, 0.45);
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 10;
    roundRect(ctx, x, 14, 9, 38, 3);
    ctx.fillStyle = linear(ctx, x, 0, x + 9, 0, [
      [0, '#a8743d'],
      [1, '#6e4520'],
    ]);
    ctx.fill();
    ctx.strokeStyle = '#3e2610';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // pointed tip
    ctx.fillStyle = '#c99b63';
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x + 4.5, 7);
    ctx.lineTo(x + 9, 15);
    ctx.fill();
  }
  // cross beams
  ctx.fillStyle = '#5a3818';
  ctx.fillRect(6, 24, 52, 5);
  ctx.fillRect(6, 40, 52, 5);
  ctx.fillStyle = '#d7d2c4';
  for (const x of [12, 32, 52]) {
    circle(ctx, x, 26.5, 1.4, '#d7d2c4');
    circle(ctx, x, 42.5, 1.4, '#d7d2c4');
  }
}

export function drawMine(ctx: Ctx, cx = 12, cy = 12, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  softShadow(ctx, 1, 2, 10, 7, 0.4);
  circle(
    ctx,
    0,
    0,
    8,
    radial(
      ctx,
      0,
      0,
      8,
      [
        [0, '#6e7166'],
        [1, '#2a2c26'],
      ],
      -3,
      -3,
    ),
    '#15160f',
    1.5,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    circle(ctx, Math.cos(a) * 8.5, Math.sin(a) * 8.5, 1.8, '#3a3c33');
  }
  ctx.save();
  ctx.shadowColor = '#ff3b2f';
  ctx.shadowBlur = 6;
  circle(ctx, 0, 0, 2.4, '#ff3b2f');
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ enemies (face +x)

export function drawHealer(ctx: Ctx) {
  const c = 24;
  softShadow(ctx, c, c + 4, 15, 11, 0.4);
  // robe
  ellipse(
    ctx,
    c - 2,
    c,
    12,
    11,
    radial(
      ctx,
      c - 2,
      c,
      12,
      [
        [0, '#ffffff'],
        [0.7, '#d9e9d0'],
        [1, '#8fb08a'],
      ],
      c - 5,
      c - 4,
    ),
  );
  ctx.strokeStyle = '#5d7a58';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // green cross on the back
  ctx.fillStyle = '#36c46b';
  ctx.fillRect(c - 6, c - 1.8, 9, 3.6);
  ctx.fillRect(c - 3.3, c - 4.5, 3.6, 9);
  // hood / head
  circle(
    ctx,
    c + 9,
    c,
    6.5,
    radial(
      ctx,
      c + 9,
      c,
      7,
      [
        [0, '#f4f7ef'],
        [1, '#9cb596'],
      ],
      c + 7,
      c - 2,
    ),
    '#5d7a58',
    1.2,
  );
  circle(ctx, c + 12, c, 2.4, '#f2c9a0');
  // staff with glowing gem
  ctx.strokeStyle = '#7a5a2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(c + 2, c + 10);
  ctx.lineTo(c + 18, c + 8);
  ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#6dffa8';
  ctx.shadowBlur = 8;
  circle(ctx, c + 19, c + 8, 3, '#8dffb9');
  ctx.restore();
}

export function drawSplitter(ctx: Ctx) {
  const c = 26;
  softShadow(ctx, c, c + 5, 19, 13, 0.4);
  // three lumps fused together
  for (const [dx, dy, r] of [
    [-6, -5, 10],
    [-6, 6, 10],
    [5, 0, 12],
  ] as const) {
    circle(
      ctx,
      c + dx,
      c + dy,
      r,
      radial(
        ctx,
        c + dx,
        c + dy,
        r,
        [
          [0, '#e6ff8f'],
          [0.6, '#a9cc3a'],
          [1, '#5c7a14'],
        ],
        c + dx - 3,
        c + dy - 3,
      ),
      '#3d5210',
      1.4,
    );
  }
  // cracks
  ctx.strokeStyle = 'rgba(40,60,10,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c - 2, c - 10);
  ctx.lineTo(c, c - 3);
  ctx.lineTo(c - 3, c + 3);
  ctx.lineTo(c, c + 10);
  ctx.stroke();
  circle(ctx, c + 10, c - 3, 2, '#1c2a05');
  circle(ctx, c + 10, c + 3, 2, '#1c2a05');
}

export function drawKnight(ctx: Ctx) {
  const c = 26;
  softShadow(ctx, c, c + 4, 17, 13, 0.45);
  // cape
  ellipse(ctx, c - 5, c, 11, 12, '#8a2a2a');
  // armored body
  circle(
    ctx,
    c - 1,
    c,
    11,
    radial(
      ctx,
      c - 1,
      c,
      11,
      [
        [0, '#e3e9f2'],
        [0.6, '#9fb0c8'],
        [1, '#56647a'],
      ],
      c - 4,
      c - 4,
    ),
    '#2d3645',
    1.5,
  );
  // helmet with visor
  circle(
    ctx,
    c + 9,
    c,
    7,
    radial(
      ctx,
      c + 9,
      c,
      7,
      [
        [0, '#f0f4f9'],
        [1, '#7c8ba3'],
      ],
      c + 7,
      c - 2,
    ),
    '#2d3645',
    1.3,
  );
  ctx.fillStyle = '#1b2230';
  ctx.fillRect(c + 11, c - 3.5, 3, 7);
  // tower shield on the left arm
  roundRect(ctx, c + 1, c - 17, 12, 9, 3);
  ctx.fillStyle = linear(ctx, 0, c - 17, 0, c - 8, [
    [0, '#5b8fe0'],
    [1, '#2c4f96'],
  ]);
  ctx.fill();
  ctx.strokeStyle = '#ffd35c';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // sword
  ctx.strokeStyle = '#dfe5ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c + 4, c + 11);
  ctx.lineTo(c + 18, c + 13);
  ctx.stroke();
}

/** Translucent energy dome drawn around shielded enemies (scaled per enemy). */
export function drawShieldBubble(ctx: Ctx) {
  const c = 32;
  circle(
    ctx,
    c,
    c,
    28,
    radial(ctx, c, c, 28, [
      [0, 'rgba(120,180,255,0)'],
      [0.7, 'rgba(120,180,255,0.15)'],
      [1, 'rgba(160,210,255,0.55)'],
    ]),
  );
  circle(ctx, c, c, 27, undefined, 'rgba(190,225,255,0.8)', 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 22, -2.6, -1.6);
  ctx.stroke();
}
