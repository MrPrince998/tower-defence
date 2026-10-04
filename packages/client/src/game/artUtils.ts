/** Canvas 2D drawing helpers shared by all procedural art. */
export type Ctx = CanvasRenderingContext2D;

export function hash(x: number, y: number, i = 0): number {
  let h = (x * 374761393 + y * 668265263 + i * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function ellipse(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  fill?: string | CanvasGradient,
  stroke?: string,
  lw = 2,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function radial(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  stops: [number, string][],
  fx = cx,
  fy = cy,
) {
  const g = ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.35) {
  ellipse(
    ctx,
    cx,
    cy,
    rx,
    ry,
    radial(ctx, cx, cy, rx, [
      [0, `rgba(0,0,0,${alpha})`],
      [1, 'rgba(0,0,0,0)'],
    ]),
  );
}
