// Gargamel vẽ thủ tục (placeholder): khung 512x512, chân chạm đáy khung, anchor (0.5, 1).
// Mỗi khung có track vị trí bàn tay cầm túi để gắn sprite túi.
import { INK, applyXform, inkEllipse, inked, limb, makeCanvas, shade, xform, type Pt } from './draw';
import type { Track } from './smurfArt';

export const GARG_FRAME = 512;
const PIVOT: Pt = [250, 500];
const ROBE = '#23232e';
const ROBE_HI = '#3c3c4e';
const SKIN = '#f6c8a4';
const SHOE = '#e2262c';

interface Limb {
  a: number;
  bend: number;
}

type GFace = 'evil' | 'angry' | 'shock' | 'dizzy' | 'laugh';

export interface GargPose {
  front: Limb;
  back: Limb;
  armF: Limb;
  armB: Limb;
  bob?: number;
  lean?: number;
  rot?: number;
  tx?: number;
  ty?: number;
  face?: GFace;
  /** tay trước nắm hờ (cầm túi) hay xoè ngón */
  grip?: boolean;
}

function legPts(hip: Pt, l: Limb): [Pt, Pt, Pt] {
  const knee: Pt = [hip[0] + 62 * Math.sin(l.a), hip[1] + 62 * Math.cos(l.a)];
  const sa = l.a - l.bend;
  const ankle: Pt = [knee[0] + 60 * Math.sin(sa), knee[1] + 60 * Math.cos(sa)];
  return [hip, knee, ankle];
}

function armPts(sh: Pt, l: Limb): [Pt, Pt, Pt] {
  const el: Pt = [sh[0] + 62 * Math.sin(l.a), sh[1] + 62 * Math.cos(l.a)];
  const fa = l.a + l.bend;
  const hand: Pt = [el[0] + 58 * Math.sin(fa), el[1] + 58 * Math.cos(fa)];
  return [sh, el, hand];
}

function drawLeg(ctx: CanvasRenderingContext2D, hip: Pt, l: Limb, dark: boolean) {
  const [h, k, a] = legPts(hip, l);
  limb(ctx, [h, k, a], 20, dark ? '#16161d' : '#2a2a36', 4);
  // giày đỏ khổng lồ
  const dir = Math.max(-0.5, Math.min(0.5, (l.a - l.bend) * 0.4));
  ctx.save();
  ctx.translate(a[0], a[1] + 6);
  ctx.rotate(dir);
  const col = dark ? shade(SHOE, -0.18) : SHOE;
  inked(ctx, col, 5, () => {
    ctx.moveTo(-26, -14);
    ctx.bezierCurveTo(-10, -26, 40, -24, 62, -6);
    ctx.bezierCurveTo(74, 4, 62, 18, 40, 18);
    ctx.lineTo(-22, 18);
    ctx.bezierCurveTo(-40, 16, -40, -6, -26, -14);
  });
  inked(ctx, 'rgba(255,255,255,.45)', 0, () => ctx.ellipse(28, -8, 16, 5, -0.1, 0, Math.PI * 2));
  ctx.restore();
}

function drawHand(ctx: CanvasRenderingContext2D, p: Pt, dirA: number, grip: boolean) {
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(-dirA + Math.PI / 2);
  if (grip) {
    inkEllipse(ctx, 6, 0, 17, 14, SKIN, 4);
    ctx.beginPath();
    ctx.moveTo(4, -8);
    ctx.lineTo(12, -8);
    ctx.moveTo(4, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(4, 8);
    ctx.lineTo(12, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    inkEllipse(ctx, 2, 0, 14, 13, SKIN, 4);
    for (let i = -2; i <= 2; i++) {
      limb(
        ctx,
        [
          [8, i * 6],
          [30, i * 9 + 2],
          [40, i * 12 + 8],
        ],
        6,
        SKIN,
        3,
      );
    }
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, hx: number, hy: number, face: GFace) {
  // tóc lơ thơ phía sau
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 46, hy - 12 + i * 12);
    ctx.bezierCurveTo(hx - 70, hy - 20 + i * 14, hx - 74, hy + i * 12, hx - 86, hy - 6 + i * 16);
    ctx.stroke();
  }
  // sọ hói
  inkEllipse(ctx, hx, hy, 54, 56, SKIN, 5);
  inked(ctx, 'rgba(255,255,255,.35)', 0, () => ctx.ellipse(hx - 14, hy - 30, 18, 10, -0.4, 0, Math.PI * 2));
  // tai
  inkEllipse(ctx, hx - 34, hy + 10, 12, 18, SKIN, 4);
  // nếp nhăn trán
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy - 30);
  ctx.quadraticCurveTo(hx + 22, hy - 36, hx + 38, hy - 28);
  ctx.moveTo(hx + 8, hy - 21);
  ctx.quadraticCurveTo(hx + 24, hy - 26, hx + 40, hy - 18);
  ctx.stroke();

  // cằm + miệng
  const open = face === 'laugh' || face === 'shock' || face === 'angry' || face === 'evil';
  inked(ctx, SKIN, 5, () => {
    ctx.moveTo(hx + 10, hy + 40);
    ctx.quadraticCurveTo(hx + 30, hy + 74, hx + 62, hy + 60);
    ctx.quadraticCurveTo(hx + 70, hy + 46, hx + 60, hy + 36);
  });
  if (open) {
    inked(ctx, '#5a1020', 4, () => {
      ctx.moveTo(hx + 22, hy + 36);
      ctx.quadraticCurveTo(hx + 44, hy + (face === 'shock' ? 66 : 56), hx + 66, hy + 36);
      ctx.closePath();
    });
    // răng xấu
    ctx.fillStyle = '#fffbe6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const [x, w] of [
      [hx + 30, 7],
      [hx + 46, 8],
    ]) {
      ctx.beginPath();
      ctx.rect(x, hy + 36, w, 9);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(hx + 22, hy + 40);
    ctx.quadraticCurveTo(hx + 44, hy + 48, hx + 64, hy + 38);
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // mắt
  if (face === 'dizzy') {
    ctx.beginPath();
    ctx.arc(hx + 30, hy - 4, 9, 0, Math.PI * 1.6);
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    inkEllipse(ctx, hx + 30, hy - 4, 12, 14, '#ffffff', 3.5);
    const px = face === 'shock' ? hx + 31 : hx + 36;
    inkEllipse(ctx, px, hy - 2, 4.5, 5.5, INK, 0);
  }
  // lông mày rậm
  inked(ctx, INK, 0, () => {
    const up = face === 'shock' ? -10 : face === 'angry' ? 6 : 0;
    ctx.moveTo(hx + 8, hy - 18 + (face === 'angry' ? -6 : 0));
    ctx.quadraticCurveTo(hx + 26, hy - 30 + up, hx + 50, hy - 16 + up);
    ctx.lineTo(hx + 46, hy - 10 + up);
    ctx.quadraticCurveTo(hx + 26, hy - 20 + up, hx + 10, hy - 10);
    ctx.closePath();
  });

  // mũi khoằm to
  inked(ctx, SKIN, 5, () => {
    ctx.moveTo(hx + 38, hy - 10);
    ctx.bezierCurveTo(hx + 70, hy - 14, hx + 96, hy + 10, hx + 92, hy + 32);
    ctx.bezierCurveTo(hx + 90, hy + 44, hx + 74, hy + 42, hx + 70, hy + 30);
    ctx.bezierCurveTo(hx + 62, hy + 30, hx + 52, hy + 30, hx + 46, hy + 22);
  });
  inked(ctx, 'rgba(230,80,80,.35)', 0, () => ctx.ellipse(hx + 82, hy + 28, 10, 8, 0.3, 0, Math.PI * 2));
}

function drawRobe(ctx: CanvasRenderingContext2D, hip: Pt, bob: number) {
  const [x, y] = hip;
  inked(ctx, ROBE, 5, () => {
    ctx.moveTo(x + 60, y - 150 + bob); // cổ trước
    ctx.bezierCurveTo(x + 80, y - 110, x + 70, y - 40, x + 52, y + 44); // ngực → vạt trước
    // vạt áo rách
    ctx.lineTo(x + 34, y + 34);
    ctx.lineTo(x + 18, y + 50);
    ctx.lineTo(x + 2, y + 36);
    ctx.lineTo(x - 18, y + 52);
    ctx.lineTo(x - 34, y + 36);
    ctx.lineTo(x - 52, y + 46);
    ctx.bezierCurveTo(x - 76, y - 20, x - 70, y - 120, x - 40, y - 160 + bob); // lưng gù
    ctx.bezierCurveTo(x - 10, y - 186 + bob, x + 40, y - 176 + bob, x + 60, y - 150 + bob);
  });
  // nếp áo và mảnh vá
  ctx.strokeStyle = ROBE_HI;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 120);
  ctx.quadraticCurveTo(x - 46, y - 40, x - 30, y + 30);
  ctx.moveTo(x + 30, y - 110);
  ctx.quadraticCurveTo(x + 40, y - 30, x + 26, y + 30);
  ctx.stroke();
  ctx.save();
  ctx.translate(x - 30, y - 40);
  ctx.rotate(-0.2);
  inked(ctx, '#6b5a48', 3, () => ctx.rect(-14, -12, 28, 24));
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -8, 20, 16);
  ctx.restore();
}

export interface GargResult {
  hand: Track;
}

export function drawGargamel(ctx: CanvasRenderingContext2D, pose: GargPose): GargResult {
  const bob = pose.bob ?? 0;
  const lean = pose.lean ?? 0;
  const rot = pose.rot ?? 0;
  const tx = pose.tx ?? 0;
  const ty = pose.ty ?? 0;
  const face = pose.face ?? 'evil';
  const hip: Pt = [236, 362 + bob];

  ctx.save();
  applyXform(ctx, PIVOT, rot, tx, ty);

  // tay sau (sau lưng)
  const upper = (draw: () => void) => {
    ctx.save();
    applyXform(ctx, hip, lean, 0, 0);
    draw();
    ctx.restore();
  };
  const shoulderB: Pt = [262, 222 + bob];
  const shoulderF: Pt = [282, 230 + bob];
  upper(() => {
    const [s, e, h] = armPts(shoulderB, pose.armB);
    limb(ctx, [s, e, h], 26, '#16161d', 4);
    drawHand(ctx, h, pose.armB.a + pose.armB.bend, false);
  });
  drawLeg(ctx, [hip[0] - 14, hip[1] + 20], pose.back, true);
  upper(() => drawRobe(ctx, hip, 0));
  drawLeg(ctx, [hip[0] + 12, hip[1] + 20], pose.front, false);
  upper(() => drawHead(ctx, 312, 160 + bob, face));
  let handLocal: Pt = [0, 0];
  let handDir = 0;
  upper(() => {
    const [s, e, h] = armPts(shoulderF, pose.armF);
    limb(ctx, [s, e, h], 28, ROBE, 4.5);
    // cổ tay áo
    inkEllipse(ctx, h[0] - 10 * Math.sin(pose.armF.a + pose.armF.bend), h[1] - 10 * Math.cos(pose.armF.a + pose.armF.bend), 17, 17, ROBE_HI, 4);
    handDir = pose.armF.a + pose.armF.bend;
    drawHand(ctx, h, handDir, pose.grip ?? true);
    handLocal = h;
  });
  ctx.restore();

  const hp = xform(xform(handLocal, hip, lean, 0, 0), PIVOT, rot, tx, ty);
  return { hand: [hp[0], hp[1], rot + lean] };
}

const L = (a: number, bend: number): Limb => ({ a, bend });

function runPose(i: number): GargPose {
  const ph = (i / 8) * Math.PI * 2;
  const s = Math.sin(ph);
  return {
    front: L(0.6 * s + 0.05, 0.2 + Math.max(0, -s) * 1.0),
    back: L(-0.6 * s + 0.05, 0.2 + Math.max(0, s) * 1.0),
    armF: L(1.05 + 0.12 * s, -0.55),
    armB: L(0.7 * s - 0.2, 0.5),
    bob: -Math.abs(Math.cos(ph)) * 10 + 4,
    lean: 0.16,
    face: 'evil',
  };
}

export const GARG_ANIMS: Record<string, { frames: GargPose[]; fps: number; loop: boolean }> = {
  gargamel_run: { frames: Array.from({ length: 8 }, (_, i) => runPose(i)), fps: 12, loop: true },
  gargamel_lunge: {
    fps: 12,
    loop: false,
    frames: [
      { front: L(0.5, 1.1), back: L(-0.4, 0.8), armF: L(2.7, 0.4), armB: L(-0.6, 0.5), bob: 14, lean: -0.08, face: 'evil' },
      { front: L(0.9, 0.4), back: L(-0.8, 0.2), armF: L(2.5, -0.3), armB: L(-0.9, 0.3), bob: -8, lean: 0.25, face: 'evil' },
      { front: L(1.0, 0.9), back: L(-0.9, 0.4), armF: L(1.8, -0.4), armB: L(-1.0, 0.4), bob: 0, lean: 0.5, face: 'laugh' },
      { front: L(1.1, 1.3), back: L(-0.9, 0.5), armF: L(0.9, -0.2), armB: L(-1.1, 0.4), bob: 24, lean: 0.72, face: 'laugh' },
      { front: L(1.0, 1.3), back: L(-0.8, 0.6), armF: L(0.8, -0.3), armB: L(-1.0, 0.5), bob: 26, lean: 0.66, face: 'evil' },
      { front: L(0.6, 0.9), back: L(-0.4, 0.6), armF: L(1.1, -0.5), armB: L(-0.4, 0.5), bob: 10, lean: 0.36, face: 'evil' },
    ],
  },
  gargamel_miss_fall: {
    fps: 10,
    loop: false,
    frames: [
      { front: L(1.1, 1.0), back: L(-1.0, 0.3), armF: L(1.0, -0.3), armB: L(-1.2, 0.3), bob: 20, lean: 0.85, face: 'shock' },
      { front: L(0.6, 0.6), back: L(-1.1, 0.2), armF: L(1.4, -0.2), armB: L(2.4, 0.3), lean: 0.6, rot: 0.55, tx: 20, ty: -10, face: 'shock' },
      { front: L(0.2, 0.4), back: L(-0.6, 0.4), armF: L(1.6, 0.0), armB: L(2.6, 0.2), lean: 0.4, rot: 1.0, tx: 6, ty: -40, face: 'shock' },
      { front: L(-0.3, 0.8), back: L(-0.1, 1.0), armF: L(1.6, 0.1), armB: L(2.8, 0.2), lean: 0.2, rot: 1.42, tx: -60, ty: -66, face: 'dizzy' },
      { front: L(-0.4, 1.2), back: L(0.1, 1.4), armF: L(1.5, 0.2), armB: L(2.8, 0.2), lean: 0.15, rot: 1.5, tx: -66, ty: -60, face: 'dizzy' },
      { front: L(-0.5, 1.4), back: L(0.2, 1.6), armF: L(0.6, 0.6), armB: L(0.8, 0.6), lean: -0.2, rot: 1.45, tx: -64, ty: -60, face: 'angry' },
    ],
  },
  gargamel_angry: {
    fps: 9,
    loop: true,
    frames: [
      { front: L(1.2, 2.0), back: L(0.0, 0.1), armF: L(2.8, 1.4), armB: L(2.6, 1.3), bob: -6, lean: 0.05, face: 'angry' },
      { front: L(0.25, 0.1), back: L(-0.2, 0.1), armF: L(2.4, 1.6), armB: L(2.9, 1.4), bob: 6, lean: 0.1, face: 'angry' },
      { front: L(0.1, 0.1), back: L(1.0, 1.9), armF: L(2.9, 1.3), armB: L(2.4, 1.5), bob: -6, lean: 0.05, face: 'angry' },
      { front: L(0.2, 0.1), back: L(-0.25, 0.1), armF: L(2.5, 1.5), armB: L(2.8, 1.3), bob: 6, lean: 0.1, face: 'angry' },
    ],
  },
};

export interface GeneratedGargAnim {
  frames: HTMLCanvasElement[];
  hand: Track[];
  fps: number;
  loop: boolean;
}

export function generateGargamelAnims(): Record<string, GeneratedGargAnim> {
  const out: Record<string, GeneratedGargAnim> = {};
  for (const [key, def] of Object.entries(GARG_ANIMS)) {
    const g: GeneratedGargAnim = { frames: [], hand: [], fps: def.fps, loop: def.loop };
    for (const pose of def.frames) {
      const [c, ctx] = makeCanvas(GARG_FRAME, GARG_FRAME);
      const r = drawGargamel(ctx, pose);
      g.frames.push(c);
      g.hand.push(r.hand);
    }
    out[key] = g;
  }
  return out;
}
