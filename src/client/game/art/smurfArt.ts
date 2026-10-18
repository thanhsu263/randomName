// Xì trum vẽ thủ tục (placeholder) theo spec: khung 256x256, nhân vật đứng giữa đáy khung, anchor (0.5, 1).
// Mũ được vẽ thành layer riêng (smurf_hat) để gắn nhãn tên; mỗi khung có "track" vị trí đầu/thân.
import {
  INK,
  SMURF_BLUE,
  SMURF_BLUE_DARK,
  WHITE,
  SGU_BLUE,
  applyXform,
  inkEllipse,
  inked,
  limb,
  makeCanvas,
  roundRectPath,
  shade,
  xform,
  type Pt,
} from './draw';

export const SMURF_FRAME = 256;
const PIVOT: Pt = [124, 248];
/** Vị trí tâm đầu ở tư thế chuẩn (dùng làm gốc cho mũ và phụ kiện trên đầu). */
export const SMURF_HEAD: Pt = [130, 110];
/** Tâm thân ở tư thế chuẩn (gốc cho balo, sách, huy hiệu). */
export const SMURF_BODY: Pt = [122, 186];

/** [x, y, rot] trong toạ độ khung hình. */
export type Track = [number, number, number];

interface Limb {
  a: number;
  bend: number;
}

export type Face = 'run' | 'scared' | 'dizzy' | 'happy' | 'determined';

export interface SmurfPose {
  front: Limb;
  back: Limb;
  armF: Limb;
  armB: Limb;
  bob?: number;
  rot?: number;
  tx?: number;
  ty?: number;
  headTilt?: number;
  face?: Face;
  /** co giãn theo trục dọc (squash & stretch) */
  squash?: number;
}

const LEG_W = 15;
const ARM_W = 10;

function legPoints(hip: Pt, l: Limb): [Pt, Pt, Pt] {
  const knee: Pt = [hip[0] + 23 * Math.sin(l.a), hip[1] + 23 * Math.cos(l.a)];
  const sa = l.a - l.bend;
  const ankle: Pt = [knee[0] + 21 * Math.sin(sa), knee[1] + 21 * Math.cos(sa)];
  return [hip, knee, ankle];
}

function armPoints(sh: Pt, l: Limb): [Pt, Pt, Pt] {
  const elbow: Pt = [sh[0] + 19 * Math.sin(l.a), sh[1] + 19 * Math.cos(l.a)];
  const fa = l.a + l.bend;
  const hand: Pt = [elbow[0] + 17 * Math.sin(fa), elbow[1] + 17 * Math.cos(fa)];
  return [sh, elbow, hand];
}

function drawLeg(ctx: CanvasRenderingContext2D, hip: Pt, l: Limb, shadeAmt: number) {
  const [h, k, a] = legPoints(hip, l);
  const col = shadeAmt ? shade(WHITE, shadeAmt) : WHITE;
  limb(ctx, [h, k, a], LEG_W, col, 3.5);
  // giày trắng
  const sa = l.a - l.bend;
  const dir = Math.max(-0.6, Math.min(0.6, sa * 0.35));
  inkEllipse(ctx, a[0] + 7 * Math.cos(dir), a[1] + 3, 13, 8, col, 3.5, dir);
}

function drawArm(ctx: CanvasRenderingContext2D, sh: Pt, l: Limb, color: string) {
  const [s, e, h] = armPoints(sh, l);
  limb(ctx, [s, e, h], ARM_W, color, 3.5);
  inkEllipse(ctx, h[0], h[1], 7.5, 7.5, color, 3.5);
}

function drawFace(ctx: CanvasRenderingContext2D, hx: number, hy: number, face: Face) {
  // tai
  inkEllipse(ctx, hx - 24, hy + 6, 9, 12, SMURF_BLUE, 3.5);
  ctx.beginPath();
  ctx.arc(hx - 24, hy + 6, 5, -1.2, 1.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // mắt (góc nhìn 3/4: 2 mắt sát nhau phía trên mũi)
  const eye = (x: number, y: number, rx: number, ry: number) => {
    inkEllipse(ctx, x, y, rx, ry, WHITE, 3);
    if (face === 'dizzy') {
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 6);
      ctx.lineTo(x + 5, y + 6);
      ctx.moveTo(x + 5, y - 6);
      ctx.lineTo(x - 5, y + 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else if (face === 'happy') {
      ctx.beginPath();
      ctx.arc(x + 1, y + 3, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else {
      const pr = face === 'scared' ? 3 : 4.2;
      inkEllipse(ctx, x + 3, y + 1, pr, pr * 1.5, INK, 0);
      inkEllipse(ctx, x + 4, y - 2, 1.4, 1.8, WHITE, 0);
    }
  };
  eye(hx + 10, hy - 3, 9, 13);
  eye(hx + 27, hy - 4, 8, 12);
  if (face === 'determined' || face === 'scared') {
    ctx.beginPath();
    const up = face === 'scared' ? -6 : 4;
    ctx.moveTo(hx + 2, hy - 20 + (face === 'scared' ? 2 : 0));
    ctx.lineTo(hx + 18, hy - 18 + up * 0.3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  // miệng
  ctx.save();
  if (face === 'run' || face === 'scared') {
    inked(ctx, '#b3263a', 3, () => {
      if (face === 'scared') ctx.ellipse(hx + 22, hy + 27, 6, 7, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(hx + 6, hy + 21);
        ctx.quadraticCurveTo(hx + 20, hy + 40, hx + 36, hy + 22);
        ctx.closePath();
      }
    });
    if (face === 'run') {
      inked(ctx, '#ff8fa3', 0, () => ctx.ellipse(hx + 20, hy + 29, 6, 3, 0, 0, Math.PI * 2));
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(hx + 8, hy + 23);
    ctx.quadraticCurveTo(hx + 22, hy + (face === 'dizzy' ? 26 : 34), hx + 35, hy + 22);
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();

  // mũi to tròn
  inkEllipse(ctx, hx + 36, hy + 11, 16, 13, SMURF_BLUE, 3.5, -0.15);
  inkEllipse(ctx, hx + 40, hy + 6, 4, 3, shade(SMURF_BLUE, 0.45), 0);
}

export interface PoseResult {
  head: Track;
  body: Track;
}

/** Vẽ một tư thế xì trum (không gồm mũ) lên ctx. Trả về track đầu/thân. */
export function drawSmurf(ctx: CanvasRenderingContext2D, pose: SmurfPose): PoseResult {
  const bob = pose.bob ?? 0;
  const rot = pose.rot ?? 0;
  const tx = pose.tx ?? 0;
  const ty = pose.ty ?? 0;
  const tilt = pose.headTilt ?? 0;
  const face = pose.face ?? 'run';
  const sq = pose.squash ?? 1;

  ctx.save();
  applyXform(ctx, PIVOT, rot, tx, ty);
  if (sq !== 1) {
    ctx.translate(PIVOT[0], PIVOT[1]);
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.translate(-PIVOT[0], -PIVOT[1]);
  }

  const hip: Pt = [120, 196 + bob];
  const shoulder: Pt = [126, 164 + bob];
  const head: Pt = [SMURF_HEAD[0], SMURF_HEAD[1] + bob];

  // tay sau, chân sau
  drawArm(ctx, [shoulder[0] - 6, shoulder[1]], pose.armB, SMURF_BLUE_DARK);
  drawLeg(ctx, [hip[0] - 6, hip[1] + 4], pose.back, -0.1);

  // ngực xanh
  inkEllipse(ctx, 123, 176 + bob, 19, 21, SMURF_BLUE, 3.5);
  // đuôi
  inkEllipse(ctx, hip[0] - 25, hip[1] - 4, 7, 7, SMURF_BLUE, 3.5);
  // quần trắng
  inked(ctx, WHITE, 3.5, () => {
    ctx.moveTo(hip[0] - 22, hip[1] - 14);
    ctx.quadraticCurveTo(hip[0], hip[1] - 22, hip[0] + 21, hip[1] - 14);
    ctx.quadraticCurveTo(hip[0] + 26, hip[1] + 6, hip[0] + 12, hip[1] + 14);
    ctx.lineTo(hip[0] - 14, hip[1] + 14);
    ctx.quadraticCurveTo(hip[0] - 28, hip[1] + 4, hip[0] - 22, hip[1] - 14);
  });
  // nếp quần
  ctx.beginPath();
  ctx.moveTo(hip[0] - 4, hip[1] - 2);
  ctx.quadraticCurveTo(hip[0] + 6, hip[1] + 4, hip[0] + 4, hip[1] + 12);
  ctx.strokeStyle = 'rgba(27,26,43,.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawLeg(ctx, [hip[0] + 6, hip[1] + 4], pose.front, 0);

  // đầu
  ctx.save();
  ctx.translate(head[0], head[1] + 30);
  ctx.rotate(tilt);
  ctx.translate(-head[0], -head[1] - 30);
  inkEllipse(ctx, head[0], head[1], 37, 36, SMURF_BLUE, 4);
  // má sáng
  inked(ctx, 'rgba(255,255,255,.18)', 0, () => ctx.ellipse(head[0] - 6, head[1] + 12, 14, 9, 0, 0, Math.PI * 2));
  drawFace(ctx, head[0], head[1], face);
  ctx.restore();

  // tay trước
  drawArm(ctx, [shoulder[0] + 4, shoulder[1] + 2], pose.armF, SMURF_BLUE);
  ctx.restore();

  // track (áp dụng cùng phép biến đổi)
  const sqf = (p: Pt): Pt =>
    sq === 1 ? p : [PIVOT[0] + (p[0] - PIVOT[0]) / Math.sqrt(sq), PIVOT[1] + (p[1] - PIVOT[1]) * sq];
  const hp = xform(sqf(head), PIVOT, rot, tx, ty);
  const bp = xform(sqf([SMURF_BODY[0], SMURF_BODY[1] + bob]), PIVOT, rot, tx, ty);
  return { head: [hp[0], hp[1], rot + tilt], body: [bp[0], bp[1], rot] };
}

// ---------------- Khung hình các hoạt cảnh ----------------

const L = (a: number, bend: number): Limb => ({ a, bend });

function runPose(i: number, n = 8): SmurfPose {
  const ph = (i / n) * Math.PI * 2;
  const s = Math.sin(ph);
  return {
    front: L(0.85 * s, 0.25 + Math.max(0, -s) * 1.1),
    back: L(-0.85 * s, 0.25 + Math.max(0, s) * 1.1),
    armF: L(-1.0 * s + 0.2, -0.9),
    armB: L(1.0 * s + 0.2, -0.9),
    bob: -Math.abs(Math.cos(ph)) * 7 + 3,
    rot: 0.13,
    headTilt: 0.04 * Math.sin(ph * 2),
    face: 'run',
  };
}

export const SMURF_ANIMS: Record<string, { frames: SmurfPose[]; fps: number; loop: boolean }> = {
  smurf_run: { frames: Array.from({ length: 8 }, (_, i) => runPose(i)), fps: 14, loop: true },
  smurf_trip: {
    fps: 12,
    loop: false,
    frames: [
      { front: L(-0.5, 0.2), back: L(0.5, 0.9), armF: L(2.4, 0.3), armB: L(2.0, 0.3), rot: 0.3, face: 'scared' },
      { front: L(-0.7, 0.1), back: L(0.3, 0.8), armF: L(2.0, 0.2), armB: L(2.3, 0.4), rot: 0.6, tx: 8, face: 'scared' },
      { front: L(-0.8, 0.3), back: L(-0.2, 0.6), armF: L(1.8, 0.2), armB: L(2.5, 0.2), rot: 0.95, tx: 4, ty: -14, face: 'scared' },
      { front: L(-0.6, 0.6), back: L(-0.3, 1.0), armF: L(1.6, 0.4), armB: L(2.6, 0.1), rot: 1.3, tx: -14, ty: -34, face: 'scared' },
      { front: L(-0.2, 1.2), back: L(-0.1, 1.0), armF: L(1.5, 0.5), armB: L(2.7, 0.1), rot: 1.5, tx: -26, ty: -46, squash: 0.92, face: 'dizzy' },
      { front: L(-0.3, 1.5), back: L(0.1, 1.2), armF: L(1.4, 0.6), armB: L(2.8, 0.1), rot: 1.55, tx: -28, ty: -46, face: 'dizzy' },
    ],
  },
  smurf_getup: {
    fps: 9,
    loop: false,
    frames: [
      { front: L(-0.4, 1.6), back: L(0.2, 1.8), armF: L(0.2, -0.3), armB: L(0.5, -0.4), rot: 1.25, tx: -22, ty: -40, face: 'dizzy' },
      { front: L(0.9, 1.9), back: L(-0.3, 2.0), armF: L(0.3, -0.2), armB: L(0.6, -0.3), rot: 0.8, tx: -10, ty: -16, face: 'dizzy' },
      { front: L(1.0, 1.6), back: L(-0.4, 1.3), armF: L(0.4, -0.4), armB: L(0.2, -0.4), rot: 0.4, bob: 12, face: 'determined' },
      { front: L(0.4, 0.6), back: L(-0.3, 0.5), armF: L(0.6, -0.8), armB: L(-0.4, -0.8), rot: 0.12, bob: 4, face: 'determined' },
    ],
  },
  smurf_jump: {
    fps: 10,
    loop: false,
    frames: [
      { front: L(0.7, 1.4), back: L(-0.1, 1.4), armF: L(-0.5, -0.6), armB: L(-0.3, -0.6), bob: 14, rot: 0.15, face: 'determined', squash: 0.9 },
      { front: L(0.6, 0.3), back: L(-0.7, 0.2), armF: L(2.6, 0.3), armB: L(2.2, 0.3), bob: -6, rot: 0.1, face: 'run', squash: 1.08 },
      { front: L(1.4, 2.0), back: L(0.6, 1.9), armF: L(2.8, 0.4), armB: L(2.5, 0.4), bob: -4, rot: 0.05, face: 'happy' },
      { front: L(0.9, 0.6), back: L(-0.2, 1.2), armF: L(2.0, -0.2), armB: L(1.6, -0.2), bob: -2, rot: 0.08, face: 'run' },
      { front: L(0.5, 1.2), back: L(-0.3, 1.3), armF: L(0.8, -0.6), armB: L(0.4, -0.6), bob: 10, rot: 0.12, face: 'run', squash: 0.92 },
    ],
  },
  smurf_struggle: {
    fps: 14,
    loop: true,
    frames: [
      { front: L(0.9, 0.2), back: L(-0.6, 0.9), armF: L(2.7, 0.3), armB: L(2.1, -0.4), rot: -0.2, face: 'scared' },
      { front: L(-0.5, 1.0), back: L(0.8, 0.3), armF: L(2.0, -0.4), armB: L(2.8, 0.3), rot: 0.15, face: 'scared' },
      { front: L(0.7, 1.2), back: L(-0.4, 0.2), armF: L(2.9, 0.2), armB: L(2.3, -0.3), rot: -0.1, face: 'scared' },
      { front: L(-0.3, 0.3), back: L(0.6, 1.1), armF: L(2.2, -0.3), armB: L(2.7, 0.2), rot: 0.25, face: 'scared' },
    ],
  },
  smurf_escape_pop: {
    fps: 10,
    loop: false,
    frames: [
      { front: L(1.6, 2.2), back: L(1.3, 2.2), armF: L(1.2, 1.2), armB: L(1.0, 1.2), rot: 0.9, tx: 6, ty: -50, face: 'scared', squash: 0.85 },
      { front: L(1.6, 2.2), back: L(1.3, 2.2), armF: L(1.2, 1.2), armB: L(1.0, 1.2), rot: 2.6, tx: 4, ty: -100, face: 'scared', squash: 0.85 },
      { front: L(0.8, 1.6), back: L(-0.4, 1.5), armF: L(1.6, -0.2), armB: L(1.3, -0.2), bob: 16, rot: 0.05, face: 'determined', squash: 0.86 },
      { front: L(0.2, 0.2), back: L(-0.1, 0.2), armF: L(0.25, -1.4), armB: L(-0.2, -1.2), bob: 2, rot: 0.02, face: 'happy' },
      { front: L(0.2, 0.2), back: L(-0.1, 0.2), armF: L(-0.3, -1.6), armB: L(0.3, -1.4), bob: 2, rot: -0.02, face: 'happy' },
    ],
  },
};

export interface GeneratedAnim {
  frames: HTMLCanvasElement[];
  head: Track[];
  body: Track[];
  fps: number;
  loop: boolean;
}

export function generateSmurfAnims(): Record<string, GeneratedAnim> {
  const out: Record<string, GeneratedAnim> = {};
  for (const [key, def] of Object.entries(SMURF_ANIMS)) {
    const g: GeneratedAnim = { frames: [], head: [], body: [], fps: def.fps, loop: def.loop };
    for (const pose of def.frames) {
      const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
      const r = drawSmurf(ctx, pose);
      g.frames.push(c);
      g.head.push(r.head);
      g.body.push(r.body);
    }
    out[key] = g;
  }
  return out;
}

// ---------------- Mũ và phụ kiện (vẽ ở tư thế chuẩn, gốc = tâm đầu / tâm thân) ----------------

export function drawHat(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [hx, hy] = SMURF_HEAD;
  inked(ctx, WHITE, 4.5, () => {
    ctx.moveTo(hx + 38, hy - 12);
    ctx.bezierCurveTo(hx + 44, hy - 46, hx + 18, hy - 72, hx - 12, hy - 70);
    ctx.bezierCurveTo(hx - 40, hy - 68, hx - 58, hy - 52, hx - 64, hy - 26);
    ctx.bezierCurveTo(hx - 66, hy - 14, hx - 58, hy - 8, hx - 52, hy - 14);
    ctx.bezierCurveTo(hx - 50, hy - 24, hx - 46, hy - 30, hx - 38, hy - 30);
    ctx.lineTo(hx - 40, hy - 2);
    ctx.quadraticCurveTo(hx - 2, hy - 14, hx + 38, hy - 12);
    ctx.closePath();
  });
  // bóng đổ mặt sau
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hx - 38, hy - 30);
  ctx.bezierCurveTo(hx - 30, hy - 50, hx - 10, hy - 62, hx + 8, hy - 64);
  ctx.bezierCurveTo(hx - 18, hy - 50, hx - 26, hy - 30, hx - 28, hy - 8);
  ctx.lineTo(hx - 40, hy - 4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,150,190,.28)';
  ctx.fill();
  ctx.restore();
  // nếp gấp
  ctx.beginPath();
  ctx.moveTo(hx - 38, hy - 30);
  ctx.quadraticCurveTo(hx - 20, hy - 40, hx - 4, hy - 64);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  return c;
}

export function drawGlasses(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [hx, hy] = SMURF_HEAD;
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = 'rgba(200,235,255,.35)';
  for (const [x, r] of [
    [hx + 10, 11],
    [hx + 28, 10],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, hy - 3, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx + 20, hy - 5);
  ctx.lineTo(hx + 18, hy - 5);
  ctx.moveTo(hx, hy - 4);
  ctx.lineTo(hx - 22, hy - 2);
  ctx.stroke();
  return c;
}

export function drawPencil(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [hx, hy] = SMURF_HEAD;
  ctx.save();
  ctx.translate(hx - 22, hy - 4);
  ctx.rotate(-0.5);
  inked(ctx, '#ffcf3a', 3, () => roundRectPath(ctx, -24, -5, 40, 10, 2));
  inked(ctx, '#f4c99a', 3, () => {
    ctx.moveTo(16, -5);
    ctx.lineTo(28, 0);
    ctx.lineTo(16, 5);
    ctx.closePath();
  });
  inked(ctx, '#ff8fa3', 3, () => roundRectPath(ctx, -30, -5, 8, 10, 2));
  ctx.restore();
  return c;
}

export function drawBackpack(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [bx, by] = SMURF_BODY;
  inked(ctx, '#e8503a', 3.5, () => roundRectPath(ctx, bx - 44, by - 34, 26, 40, 9));
  inked(ctx, '#c23b28', 3, () => roundRectPath(ctx, bx - 47, by - 12, 18, 16, 5));
  ctx.beginPath();
  ctx.moveTo(bx - 20, by - 30);
  ctx.quadraticCurveTo(bx - 6, by - 26, bx - 4, by - 10);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  return c;
}

export function drawBook(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [bx, by] = SMURF_BODY;
  ctx.save();
  ctx.translate(bx + 14, by - 18);
  ctx.rotate(0.25);
  inked(ctx, '#2a9d5c', 3.5, () => roundRectPath(ctx, -10, -18, 22, 32, 3));
  inked(ctx, '#fff6d8', 0, () => roundRectPath(ctx, 8, -16, 4, 28, 1));
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(-6, -10, 12, 4);
  ctx.restore();
  return c;
}

export function drawBadge(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
  const [bx, by] = SMURF_BODY;
  inkEllipse(ctx, bx + 6, by + 6, 9, 9, SGU_BLUE, 2.5);
  ctx.fillStyle = WHITE;
  ctx.font = '800 7px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SGU', bx + 6, by + 7);
  return c;
}

export const SMURF_ACCESSORIES = {
  acc_glasses: { draw: drawGlasses, attach: 'head' as const },
  acc_pencil: { draw: drawPencil, attach: 'head' as const },
  acc_backpack: { draw: drawBackpack, attach: 'body' as const, behind: true },
  acc_book: { draw: drawBook, attach: 'body' as const },
  acc_badge: { draw: drawBadge, attach: 'body' as const },
};
