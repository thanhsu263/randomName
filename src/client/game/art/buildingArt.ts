// Toà nhà chính Trường Đại học Sài Gòn vẽ lại theo phong cách làng xì trum (layer L1).
// Giữ kiến trúc: tường vàng, viền trắng, mái ngói đỏ, tháp đồng hồ, cửa vòm sọc, cửa chớp xanh,
// ban công lan can, huy hiệu SGU xanh trên đầu hồi, biển "TRƯỜNG ĐẠI HỌC SÀI GÒN".
import { INK, artRng, inkEllipse, inked, makeCanvas, roundRectPath, shade, starPath } from './draw';

export const BUILDING_W = 1800;
export const BUILDING_H = 840;

const WALL = '#f6b23c';
const WALL_DARK = '#e39a26';
const TRIM = '#fff6e0';
const ROOF = '#d4452e';
const SHUTTER = '#3f8a57';
const GLASS = '#3b3a4f';

function tileRoof(ctx: CanvasRenderingContext2D, pts: [number, number][], rows: number) {
  inked(ctx, ROOF, 5, () => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
  });
  // hàng ngói
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.clip();
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  ctx.strokeStyle = shade(ROOF, -0.3);
  ctx.lineWidth = 2.5;
  for (let r = 1; r < rows; r++) {
    const y = minY + ((maxY - minY) * r) / rows;
    ctx.beginPath();
    for (let x = minX; x < maxX; x += 22) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 11, y + 7, x + 22, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(minX, minY, maxX - minX, (maxY - minY) * 0.25);
  ctx.restore();
}

function stripedArch(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, band: number) {
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r + band, a0, a1);
    ctx.arc(cx, cy, r, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#ffffff' : '#4f9b62';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r + band, Math.PI, 0);
  ctx.moveTo(cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI, true);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function archWindow(ctx: CanvasRenderingContext2D, x: number, yBottom: number, w: number, h: number) {
  const r = w / 2;
  const cy = yBottom - h + r;
  inked(ctx, TRIM, 4, () => {
    ctx.moveTo(x - 10, yBottom);
    ctx.lineTo(x - 10, cy);
    ctx.arc(x + r, cy, r + 10, Math.PI, 0);
    ctx.lineTo(x + w + 10, yBottom);
    ctx.closePath();
  });
  inked(ctx, GLASS, 4, () => {
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x, cy);
    ctx.arc(x + r, cy, r, Math.PI, 0);
    ctx.lineTo(x + w, yBottom);
    ctx.closePath();
  });
  // song cửa
  ctx.strokeStyle = shade(SHUTTER, -0.2);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + r, cy - r);
  ctx.lineTo(x + r, yBottom);
  ctx.moveTo(x, cy + 10);
  ctx.lineTo(x + w, cy + 10);
  ctx.stroke();
  stripedArch(ctx, x + r, cy, r + 10, 16);
}

function shutterWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, balcony: boolean) {
  inked(ctx, TRIM, 4, () => ctx.rect(x - 8, y - 8, w + 16, h + 16));
  inked(ctx, GLASS, 3, () => ctx.rect(x, y, w, h));
  // 2 cánh cửa chớp xanh
  for (const sx of [x - w / 2 - 6, x + w + 6]) {
    inked(ctx, SHUTTER, 3.5, () => ctx.rect(sx, y - 4, w / 2, h + 8));
    ctx.strokeStyle = shade(SHUTTER, -0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let ly = y + 6; ly < y + h; ly += 9) {
      ctx.moveTo(sx + 4, ly);
      ctx.lineTo(sx + w / 2 - 4, ly);
    }
    ctx.stroke();
  }
  if (balcony) {
    const by = y + h - 30;
    inked(ctx, TRIM, 3.5, () => ctx.rect(x - 14, by, w + 28, 8));
    inked(ctx, TRIM, 3.5, () => ctx.rect(x - 14, y + h + 8, w + 28, 8));
    ctx.fillStyle = TRIM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (let bx = x - 8; bx < x + w + 10; bx += 12) {
      ctx.beginPath();
      ctx.ellipse(bx + 3, by + 22, 4, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function mushroom(ctx: CanvasRenderingContext2D, x: number, yb: number, s: number, cap: string, dots: string) {
  inked(ctx, '#fff4dc', 4, () => {
    ctx.moveTo(x - 18 * s, yb);
    ctx.quadraticCurveTo(x - 14 * s, yb - 50 * s, x - 12 * s, yb - 70 * s);
    ctx.lineTo(x + 12 * s, yb - 70 * s);
    ctx.quadraticCurveTo(x + 14 * s, yb - 50 * s, x + 18 * s, yb);
    ctx.closePath();
  });
  inked(ctx, cap, 4.5, () => {
    ctx.moveTo(x - 62 * s, yb - 62 * s);
    ctx.bezierCurveTo(x - 60 * s, yb - 140 * s, x + 60 * s, yb - 140 * s, x + 62 * s, yb - 62 * s);
    ctx.quadraticCurveTo(x, yb - 76 * s, x - 62 * s, yb - 62 * s);
  });
  for (const [dx, dy, r] of [
    [-30, -96, 10],
    [8, -112, 12],
    [36, -88, 9],
    [-6, -80, 7],
  ]) {
    inkEllipse(ctx, x + dx * s, yb + dy * s, r * s, r * s * 0.8, dots, 2.5);
  }
}

export function drawSguBuilding(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(BUILDING_W, BUILDING_H);
  const G = 820; // mặt đất
  const rng = artRng(2024);

  // --- Mái 2 cánh nhà (phía sau) ---
  tileRoof(
    ctx,
    [
      [60, 378],
      [170, 262],
      [740, 262],
      [740, 378],
    ],
    5,
  );
  tileRoof(
    ctx,
    [
      [1060, 378],
      [1060, 262],
      [1630, 262],
      [1740, 378],
    ],
    5,
  );

  // --- Tường 2 cánh ---
  for (const [x0, x1] of [
    [84, 740],
    [1060, 1716],
  ]) {
    inked(ctx, WALL, 5, () => ctx.rect(x0, 372, x1 - x0, G - 372));
    // bóng dưới mái
    ctx.fillStyle = WALL_DARK;
    ctx.fillRect(x0 + 3, 375, x1 - x0 - 6, 18);
    // gờ trắng giữa 2 tầng + chân tường
    inked(ctx, TRIM, 4, () => ctx.rect(x0 - 6, 586, x1 - x0 + 12, 18));
    inked(ctx, '#d9d2bf', 4, () => ctx.rect(x0 - 6, G - 30, x1 - x0 + 12, 30));
    inked(ctx, TRIM, 4, () => ctx.rect(x0 - 10, 366, x1 - x0 + 20, 12));
  }

  // cột trang trí (pilaster) + cửa sổ tầng trên + cửa vòm tầng trệt
  const wingWindows = (x0: number, count: number, step: number) => {
    for (let i = 0; i < count; i++) {
      const wx = x0 + i * step;
      shutterWindow(ctx, wx, 420, 56, 120, true);
      archWindow(ctx, wx - 6, G - 32, 68, 168);
    }
    for (let i = 0; i <= count; i++) {
      const px = x0 - step / 2 + 14 + i * step;
      inked(ctx, TRIM, 3.5, () => ctx.rect(px, 380, 16, 206));
    }
  };
  wingWindows(150, 4, 152);
  wingWindows(1130, 4, 152);

  // đèn tường
  for (const lx of [690, 1110]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lx, 640);
    ctx.quadraticCurveTo(lx + (lx < 900 ? 20 : -20), 630, lx + (lx < 900 ? 24 : -24), 650);
    ctx.stroke();
    inkEllipse(ctx, lx + (lx < 900 ? 24 : -24), 660, 9, 12, '#fff3b0', 3);
  }

  // --- Khối giữa ---
  const cx0 = 740;
  const cx1 = 1060;
  inked(ctx, WALL, 5, () => ctx.rect(cx0, 330, cx1 - cx0, G - 330));
  inked(ctx, TRIM, 4, () => ctx.rect(cx0 - 10, 586, cx1 - cx0 + 20, 18));
  inked(ctx, '#d9d2bf', 4, () => ctx.rect(cx0 - 10, G - 30, cx1 - cx0 + 20, 30));
  for (const px of [cx0 + 8, cx1 - 30]) inked(ctx, TRIM, 4, () => ctx.rect(px, 330, 22, G - 360));

  // mái đầu hồi với xà gỗ
  tileRoof(
    ctx,
    [
      [700, 352],
      [900, 214],
      [1100, 352],
      [1080, 362],
      [900, 240],
      [720, 362],
    ],
    3,
  );
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    for (const side of [-1, 1]) {
      const x = 900 + side * (30 + t * 160);
      const y = 250 + t * 106;
      inked(ctx, '#7a4a22', 3, () => ctx.rect(x - 5, y, 10, 22));
    }
  }
  // tam giác đầu hồi
  inked(ctx, WALL, 5, () => {
    ctx.moveTo(744, 352);
    ctx.lineTo(900, 246);
    ctx.lineTo(1056, 352);
    ctx.closePath();
  });
  // vòm sọc + huy hiệu SGU
  stripedArch(ctx, 900, 350, 60, 18);
  inkEllipse(ctx, 900, 316, 34, 34, '#1f4fae', 4);
  inkEllipse(ctx, 900, 316, 27, 27, '#2c66cc', 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 22px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SGU', 900, 319);
  // dải hoa văn dưới vòm
  inked(ctx, TRIM, 3.5, () => ctx.rect(800, 368, 200, 14));
  for (let i = 0; i < 8; i++) {
    inked(ctx, '#7c5a3a', 2, () => ctx.rect(806 + i * 24, 371, 14, 8));
  }

  // 3 cửa sổ cao giữa
  for (let i = 0; i < 3; i++) {
    const wx = 836 + i * 48;
    inked(ctx, TRIM, 3.5, () => roundRectPath(ctx, wx - 6, 396, 40, 168, 18));
    inked(ctx, SHUTTER, 3.5, () => roundRectPath(ctx, wx, 402, 28, 156, 14));
    ctx.strokeStyle = shade(SHUTTER, -0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = 418; y < 552; y += 9) {
      ctx.moveTo(wx + 4, y);
      ctx.lineTo(wx + 24, y);
    }
    ctx.stroke();
  }

  // biển tên trường + lối vào
  inked(ctx, TRIM, 4, () => ctx.rect(800, 620, 200, G - 650));
  inked(ctx, '#2d2b3d', 4, () => ctx.rect(822, 660, 156, G - 690));
  // cảnh sân trong qua cửa
  ctx.fillStyle = '#6cc24a';
  ctx.fillRect(826, 744, 148, 46);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(826, 664, 148, 80);
  for (const pillar of [770, 1006]) inked(ctx, TRIM, 4, () => roundRectPath(ctx, pillar, 604, 24, G - 634, 6));
  inked(ctx, '#ffffff', 4, () => roundRectPath(ctx, 778, 612, 244, 44, 6));
  ctx.fillStyle = '#1f4fae';
  ctx.font = '800 21px "Baloo 2", sans-serif';
  ctx.fillText('TRƯỜNG ĐẠI HỌC SÀI GÒN', 900, 630);
  ctx.font = '700 11px "Be Vietnam Pro", sans-serif';
  ctx.fillText('SAIGON UNIVERSITY', 900, 648);

  // --- Tháp đồng hồ ---
  inked(ctx, WALL, 5, () => ctx.rect(852, 130, 96, 104));
  inked(ctx, TRIM, 4, () => ctx.rect(844, 226, 112, 14));
  inkEllipse(ctx, 900, 178, 34, 34, '#fffdf2', 4);
  ctx.strokeStyle = INK;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(900 + Math.cos(a) * 26, 178 + Math.sin(a) * 26);
    ctx.lineTo(900 + Math.cos(a) * 30, 178 + Math.sin(a) * 30);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(900, 178);
  ctx.lineTo(900, 156);
  ctx.moveTo(900, 178);
  ctx.lineTo(916, 186);
  ctx.stroke();
  tileRoof(
    ctx,
    [
      [826, 138],
      [866, 74],
      [934, 74],
      [974, 138],
    ],
    3,
  );
  inked(ctx, '#7a4a22', 4, () => ctx.rect(886, 40, 28, 36));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(900, 40);
  ctx.lineTo(900, 6);
  ctx.stroke();

  // --- Nấm khổng lồ, hoa dại bên hông toà nhà (chất "làng xì trum") ---
  mushroom(ctx, 70, G, 1.15, '#e23b2e', '#ffffff');
  mushroom(ctx, 1745, G, 0.95, '#3d7fe0', '#dff0ff');
  mushroom(ctx, 1660, G, 0.6, '#ff9a2e', '#fff3d6');
  mushroom(ctx, 150, G, 0.55, '#ffcf3a', '#ffffff');
  // bồn hoa
  for (let i = 0; i < 26; i++) {
    const x = 220 + rng.float() * 1360;
    if (x > 760 && x < 1040) continue;
    const y = G - 6 - rng.float() * 18;
    const colr = rng.pick(['#ff5d8f', '#ffd23f', '#ffffff', '#ff8a3d', '#c77dff']);
    inked(ctx, colr, 2.5, () => starPath(ctx, x, y, 8, 4, 5, rng.float()));
    inkEllipse(ctx, x, y, 2.5, 2.5, '#ffe066', 0);
  }
  return c;
}
