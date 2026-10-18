// Túi vải bố của Gargamel: bag_idle (1f), bag_wriggle (6f), bag_open (4f). Khung 256x256, gốc treo = miệng túi.
import { INK, artRng, inkEllipse, inked, makeCanvas, shade } from './draw';

export const BAG_FRAME = 256;
/** Điểm treo (miệng túi, nơi bàn tay nắm) trong khung. */
export const BAG_GRIP: [number, number] = [128, 46];
const SACK = '#b9864f';

function sackPath(ctx: CanvasRenderingContext2D, bulges: [number, number, number][], openAmt: number, fat = 1) {
  const cx = 128;
  const top = 58 - openAmt * 6;
  const neckW = 16 + openAmt * 34;
  const w = 74 * fat;
  ctx.moveTo(cx - neckW, top);
  ctx.bezierCurveTo(cx - w - 10, top + 50, cx - w - 14, 210, cx - 40, 232);
  ctx.quadraticCurveTo(cx, 246, cx + 40, 232);
  ctx.bezierCurveTo(cx + w + 14, 210, cx + w + 10, top + 50, cx + neckW, top);
  ctx.closePath();
  for (const [x, y, r] of bulges) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

function drawSack(bulges: [number, number, number][], openAmt: number, fat = 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(BAG_FRAME, BAG_FRAME);
  const rng = artRng(42);
  // thân túi (+ các chỗ phồng hình xì trum đang giãy)
  ctx.beginPath();
  sackPath(ctx, bulges, openAmt, fat);
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  sackPath(ctx, bulges, openAmt, fat);
  const g = ctx.createLinearGradient(40, 0, 220, 0);
  g.addColorStop(0, shade(SACK, 0.12));
  g.addColorStop(1, shade(SACK, -0.18));
  ctx.fillStyle = g;
  ctx.fill();
  // vân vải bố
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90,55,20,.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = 50 + rng.float() * 160;
    const y = 70 + rng.float() * 170;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y + (rng.float() - 0.5) * 3);
    ctx.stroke();
  }
  // miếng vá
  inked(ctx, '#8a5a2e', 3, () => ctx.rect(150, 150, 30, 26));
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#f4dfb8';
  ctx.strokeRect(154, 154, 22, 18);
  ctx.setLineDash([]);
  ctx.restore();
  // nếp gấp
  ctx.strokeStyle = 'rgba(27,26,43,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(110, 80);
  ctx.quadraticCurveTo(96, 130, 104, 190);
  ctx.moveTo(150, 84);
  ctx.quadraticCurveTo(160, 120, 156, 140);
  ctx.stroke();

  if (openAmt > 0) {
    // miệng túi mở: lòng túi tối
    inkEllipse(ctx, 128, 58 - openAmt * 6, 16 + openAmt * 36, 6 + openAmt * 14, '#3a2410', 5);
  } else {
    // dây buộc
    inkEllipse(ctx, 128, 56, 22, 9, shade(SACK, -0.1), 5);
    inked(ctx, '#d9b56a', 4, () => {
      ctx.moveTo(108, 56);
      ctx.quadraticCurveTo(128, 66, 148, 56);
      ctx.lineTo(148, 64);
      ctx.quadraticCurveTo(128, 74, 108, 64);
      ctx.closePath();
    });
    // túm vải phía trên
    inked(ctx, shade(SACK, 0.05), 5, () => {
      ctx.moveTo(116, 52);
      ctx.lineTo(108, 30);
      ctx.quadraticCurveTo(128, 20, 148, 30);
      ctx.lineTo(140, 52);
      ctx.closePath();
    });
  }
  return c;
}

export function generateBag(): Record<string, HTMLCanvasElement[]> {
  const wr: [number, number, number][][] = [
    [[70, 140, 20]],
    [[190, 120, 22], [80, 200, 14]],
    [[128, 236, 18]],
    [[64, 110, 18], [178, 196, 20]],
    [[196, 160, 24]],
    [[100, 100, 16], [150, 230, 16]],
  ];
  return {
    bag_idle: [drawSack([], 0)],
    bag_wriggle: wr.map((b, i) => drawSack(b, 0, i % 2 ? 1.06 : 0.97)),
    bag_open: [0.25, 0.5, 0.8, 1].map((o) => drawSack([], o, 1 + o * 0.05)),
  };
}
