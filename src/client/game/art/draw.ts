// Tiện ích vẽ Canvas 2D theo phong cách truyện tranh: nét mực đen dày, màu phẳng.
import { ChaChaRng } from '@shared/rng';

export const INK = '#1b1a2b';
export const SMURF_BLUE = '#3b9be6';
export const SMURF_BLUE_DARK = '#2a7cc4';
export const WHITE = '#ffffff';
export const SGU_BLUE = '#1d5fc4';

export type Pt = [number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** RNG cố định cho đồ hoạ (ảnh vẽ ra luôn giống nhau). */
export function artRng(salt: number): ChaChaRng {
  return new ChaChaRng(salt.toString(16).padStart(64, '0'), 7);
}

/** Tô màu và viền mực cho path được dựng trong `build`. */
export function inked(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient | null, lw: number, build: () => void) {
  ctx.beginPath();
  build();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

export function ellipsePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function inkEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
  lw = 4,
  rot = 0,
) {
  inked(ctx, fill, lw, () => ellipsePath(ctx, x, y, rx, ry, rot));
}

/** Chi (tay/chân): vẽ viền mực rồi tô màu bên trong. */
export function limb(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, color: string, lw = 4) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + lw * 2;
  ctx.stroke();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, n = 5, rot = 0) {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = rot - Math.PI / 2 + (i * Math.PI) / n;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Đám mây/bụi: chuỗi hình tròn chồng lên nhau. */
export function blobPath(ctx: CanvasRenderingContext2D, circles: [number, number, number][]) {
  for (const [x, y, r] of circles) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function inkBlob(ctx: CanvasRenderingContext2D, circles: [number, number, number][], fill: string, lw = 4) {
  // viền: vẽ các hình tròn lớn hơn bằng màu mực, sau đó tô màu → viền ngoài liền mạch
  ctx.beginPath();
  blobPath(
    ctx,
    circles.map(([x, y, r]) => [x, y, r + lw / 2] as [number, number, number]),
  );
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  blobPath(
    ctx,
    circles.map(([x, y, r]) => [x, y, r - lw / 2] as [number, number, number]),
  );
  ctx.fillStyle = fill;
  ctx.fill();
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Biến đổi điểm: xoay quanh pivot rồi tịnh tiến (khớp với ctx.translate/rotate). */
export function xform(p: Pt, pivot: Pt, rot: number, tx: number, ty: number): Pt {
  const dx = p[0] - pivot[0];
  const dy = p[1] - pivot[1];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [pivot[0] + dx * c - dy * s + tx, pivot[1] + dx * s + dy * c + ty];
}

export function applyXform(ctx: CanvasRenderingContext2D, pivot: Pt, rot: number, tx: number, ty: number) {
  ctx.translate(pivot[0] + tx, pivot[1] + ty);
  ctx.rotate(rot);
  ctx.translate(-pivot[0], -pivot[1]);
}

/** Gộp nhiều khung hình thành một tấm sprite sheet dạng lưới. */
export function sheet(frames: HTMLCanvasElement[], fw: number, fh: number, cols = 4): HTMLCanvasElement {
  const c = Math.min(cols, frames.length);
  const rows = Math.ceil(frames.length / c);
  const [canvas, ctx] = makeCanvas(fw * c, fh * rows);
  frames.forEach((f, i) => ctx.drawImage(f, (i % c) * fw, Math.floor(i / c) * fh));
  return canvas;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
