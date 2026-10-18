// Cảnh vật làng xì trum: trời, mây, đồi, cây cổ thụ, nhà nấm, hàng rào, ghế đá, mặt đường,
// tiền cảnh, chướng ngại vật, hiệu ứng và UI. Tất cả vẽ thủ tục bằng Canvas 2D.
import {
  INK,
  artRng,
  inkBlob,
  inkEllipse,
  inked,
  makeCanvas,
  roundRectPath,
  shade,
  starPath,
} from './draw';

const LEAF = '#4caf3f';
const LEAF_DARK = '#2f8a33';
const TRUNK = '#8b5a2b';
const WOOD = '#b0743b';

// ---------- L0: trời, mây, đồi xa ----------

export function drawSky(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(8, 1080);
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, '#5fb8f2');
  g.addColorStop(0.55, '#a9e0ff');
  g.addColorStop(1, '#e8f8ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 1080);
  return c;
}

export function drawClouds(): HTMLCanvasElement {
  const W = 2048;
  const [c, ctx] = makeCanvas(W, 420);
  const rng = artRng(11);
  for (let i = 0; i < 7; i++) {
    const x = (i / 7) * W + rng.float() * 140;
    const y = 80 + rng.float() * 220;
    const s = 0.7 + rng.float() * 0.7;
    for (const off of [-W, 0, W]) {
      const circles: [number, number, number][] = [
        [x + off, y, 46 * s],
        [x + off + 50 * s, y - 24 * s, 58 * s],
        [x + off + 110 * s, y - 6 * s, 50 * s],
        [x + off + 150 * s, y + 10 * s, 36 * s],
        [x + off + 60 * s, y + 20 * s, 44 * s],
      ];
      inkBlob(ctx, circles, '#ffffff', 4);
      ctx.fillStyle = 'rgba(160,205,240,.45)';
      ctx.beginPath();
      ctx.ellipse(x + off + 75 * s, y + 34 * s, 90 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

export function drawHills(): HTMLCanvasElement {
  const W = 2048;
  const H = 380;
  const [c, ctx] = makeCanvas(W, H);
  const rng = artRng(12);
  const layer = (base: number, amp: number, fill: string, k1: number, k2: number, ph: number) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const t = (x / W) * Math.PI * 2;
      ctx.lineTo(x, base - amp * (0.6 * Math.sin(k1 * t + ph) + 0.4 * Math.sin(k2 * t + ph * 2)));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(27,26,43,.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  layer(200, 60, '#9fd6a0', 3, 7, 0.5);
  layer(260, 50, '#7cc47a', 4, 9, 1.7);
  // rừng xa: tán cây tròn lặp tuần hoàn
  for (let i = 0; i < 46; i++) {
    const x = (i / 46) * W + rng.float() * 20;
    const r = 26 + rng.float() * 22;
    for (const off of [-W, 0, W]) {
      inkBlob(ctx, [[x + off, 300 - r * 0.6, r]], i % 3 ? '#5aa85a' : '#4b9a50', 3);
    }
  }
  ctx.fillStyle = '#5aa85a';
  ctx.fillRect(0, 300, W, H - 300);
  return c;
}

// ---------- L1/L2: cây, nhà nấm, hàng rào, ghế đá ----------

export function drawBanyan(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(600, 760);
  const rng = artRng(21);
  // thân và rễ xoắn
  inked(ctx, TRUNK, 5, () => {
    ctx.moveTo(240, 750);
    ctx.bezierCurveTo(250, 600, 220, 520, 260, 360);
    ctx.lineTo(330, 360);
    ctx.bezierCurveTo(370, 520, 340, 600, 370, 750);
    ctx.closePath();
  });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = 262 + i * 16;
    ctx.moveTo(x, 380);
    ctx.bezierCurveTo(x - 10, 500, x + 14, 600, x - 4 + rng.float() * 10, 740);
    ctx.stroke();
  }
  // rễ phụ buông xuống
  for (const [x, len] of [
    [150, 320],
    [190, 260],
    [430, 300],
    [470, 240],
  ]) {
    inked(ctx, shade(TRUNK, 0.1), 3, () => {
      ctx.moveTo(x, 330);
      ctx.bezierCurveTo(x - 6, 330 + len * 0.4, x + 8, 330 + len * 0.8, x, 330 + len);
      ctx.lineTo(x + 8, 330 + len);
      ctx.bezierCurveTo(x + 14, 330 + len * 0.6, x + 4, 330 + len * 0.3, x + 10, 330);
      ctx.closePath();
    });
  }
  inked(ctx, TRUNK, 4, () => {
    ctx.moveTo(220, 752);
    ctx.quadraticCurveTo(190, 740, 160, 752);
    ctx.moveTo(380, 752);
    ctx.quadraticCurveTo(420, 736, 450, 752);
  });
  // tán lá lớn
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    blobs.push([90 + rng.float() * 420, 110 + rng.float() * 220, 70 + rng.float() * 40]);
  }
  inkBlob(ctx, blobs, LEAF_DARK, 5);
  inkBlob(
    ctx,
    blobs.slice(0, 9).map(([x, y, r]) => [x - 10, y - 18, r * 0.7] as [number, number, number]),
    LEAF,
    0,
  );
  for (let i = 0; i < 40; i++) {
    inkEllipse(ctx, 90 + rng.float() * 420, 80 + rng.float() * 260, 8, 5, '#79d36a', 0, rng.float() * 3);
  }
  return c;
}

export function drawRoundTree(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(380, 560);
  const rng = artRng(22);
  inked(ctx, TRUNK, 5, () => {
    ctx.moveTo(170, 552);
    ctx.quadraticCurveTo(178, 400, 168, 300);
    ctx.lineTo(214, 300);
    ctx.quadraticCurveTo(204, 400, 216, 552);
    ctx.closePath();
  });
  const blobs: [number, number, number][] = [
    [190, 190, 120],
    [110, 250, 80],
    [270, 250, 84],
    [150, 120, 80],
    [240, 120, 76],
  ];
  inkBlob(ctx, blobs, '#3fa04a', 5);
  inkBlob(ctx, [[160, 150, 60], [230, 170, 50]], '#62bf55', 0);
  for (let i = 0; i < 9; i++) {
    inkEllipse(ctx, 90 + rng.float() * 200, 90 + rng.float() * 200, 9, 9, '#e94b3c', 2.5);
  }
  return c;
}

export function drawMushroomHouse(cap: string, dots: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(440, 480);
  // thân nhà
  inked(ctx, '#f5ead2', 5, () => {
    ctx.moveTo(110, 470);
    ctx.bezierCurveTo(100, 380, 120, 300, 140, 240);
    ctx.lineTo(300, 240);
    ctx.bezierCurveTo(320, 300, 340, 380, 330, 470);
    ctx.closePath();
  });
  // ống khói đá
  inked(ctx, '#b9b2a4', 4, () => roundRectPath(ctx, 300, 60, 40, 120, 6));
  ctx.strokeStyle = 'rgba(27,26,43,.4)';
  ctx.lineWidth = 2;
  for (let y = 80; y < 180; y += 22) {
    ctx.beginPath();
    ctx.moveTo(300, y);
    ctx.lineTo(340, y);
    ctx.stroke();
  }
  // mũ nấm
  inked(ctx, cap, 5.5, () => {
    ctx.moveTo(20, 270);
    ctx.bezierCurveTo(10, 90, 430, 90, 420, 270);
    ctx.quadraticCurveTo(220, 300, 20, 270);
  });
  inked(ctx, 'rgba(255,255,255,.2)', 0, () => ctx.ellipse(150, 160, 70, 34, -0.3, 0, Math.PI * 2));
  for (const [x, y, r] of [
    [110, 200, 26],
    [220, 150, 32],
    [330, 205, 24],
    [180, 240, 16],
    [290, 130, 14],
  ]) {
    inkEllipse(ctx, x, y, r, r * 0.75, dots, 3.5);
  }
  // cửa gỗ
  inked(ctx, WOOD, 4, () => {
    ctx.moveTo(190, 470);
    ctx.lineTo(190, 390);
    ctx.arc(220, 390, 30, Math.PI, 0);
    ctx.lineTo(250, 470);
    ctx.closePath();
  });
  ctx.strokeStyle = shade(WOOD, -0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(210, 372);
  ctx.lineTo(210, 470);
  ctx.moveTo(230, 368);
  ctx.lineTo(230, 470);
  ctx.stroke();
  inkEllipse(ctx, 242, 430, 4, 4, '#ffd23f', 2);
  // cửa sổ tròn
  inkEllipse(ctx, 290, 340, 24, 24, '#ffffff', 4);
  inkEllipse(ctx, 290, 340, 17, 17, '#8fd3ff', 3);
  ctx.beginPath();
  ctx.moveTo(273, 340);
  ctx.lineTo(307, 340);
  ctx.moveTo(290, 323);
  ctx.lineTo(290, 357);
  ctx.strokeStyle = INK;
  ctx.stroke();
  inked(ctx, '#ff9ec4', 3, () => roundRectPath(ctx, 140, 320, 34, 14, 4));
  return c;
}

export function drawFence(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(360, 140);
  inked(ctx, WOOD, 4, () => roundRectPath(ctx, 6, 50, 348, 14, 4));
  inked(ctx, WOOD, 4, () => roundRectPath(ctx, 6, 92, 348, 14, 4));
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 50;
    const h = 100 + (i % 2) * 14;
    inked(ctx, shade(WOOD, i % 2 ? 0.08 : -0.04), 4, () => {
      ctx.moveTo(x, 136);
      ctx.lineTo(x, 136 - h + 14);
      ctx.lineTo(x + 14, 136 - h);
      ctx.lineTo(x + 28, 136 - h + 14);
      ctx.lineTo(x + 28, 136);
      ctx.closePath();
    });
  }
  return c;
}

export function drawBench(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(270, 120);
  inked(ctx, '#c9c3b6', 4, () => roundRectPath(ctx, 34, 60, 30, 56, 6));
  inked(ctx, '#c9c3b6', 4, () => roundRectPath(ctx, 206, 60, 30, 56, 6));
  inked(ctx, '#e1dccf', 5, () => roundRectPath(ctx, 8, 40, 254, 30, 10));
  ctx.fillStyle = 'rgba(27,26,43,.15)';
  ctx.fillRect(14, 62, 242, 6);
  return c;
}

export function drawWell(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(260, 300);
  inked(ctx, '#bdb6a8', 5, () => roundRectPath(ctx, 30, 190, 200, 104, 14));
  ctx.strokeStyle = 'rgba(27,26,43,.45)';
  ctx.lineWidth = 3;
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 5; i++) {
      ctx.strokeRect(36 + i * 40 + (r % 2) * 20, 196 + r * 32, 40, 32);
    }
  }
  inked(ctx, WOOD, 4, () => ctx.rect(46, 60, 14, 134));
  inked(ctx, WOOD, 4, () => ctx.rect(200, 60, 14, 134));
  inked(ctx, '#d4452e', 5, () => {
    ctx.moveTo(18, 74);
    ctx.lineTo(130, 10);
    ctx.lineTo(242, 74);
    ctx.closePath();
  });
  ctx.beginPath();
  ctx.moveTo(130, 70);
  ctx.lineTo(130, 150);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  inked(ctx, WOOD, 3.5, () => roundRectPath(ctx, 114, 150, 32, 30, 4));
  return c;
}

export function drawLamp(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(100, 360);
  inked(ctx, '#2e3a40', 4, () => roundRectPath(ctx, 42, 70, 16, 284, 4));
  inked(ctx, '#2e3a40', 4, () => roundRectPath(ctx, 30, 330, 40, 26, 6));
  inked(ctx, '#2e3a40', 4, () => {
    ctx.moveTo(20, 70);
    ctx.lineTo(80, 70);
    ctx.lineTo(70, 20);
    ctx.lineTo(30, 20);
    ctx.closePath();
  });
  inked(ctx, '#fff2a8', 3, () => roundRectPath(ctx, 34, 28, 32, 36, 4));
  return c;
}

export function drawBush(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(240, 140);
  const rng = artRng(31);
  inkBlob(
    ctx,
    [
      [60, 90, 46],
      [120, 70, 56],
      [180, 92, 44],
      [120, 104, 40],
    ],
    '#47a447',
    4,
  );
  for (let i = 0; i < 12; i++) {
    const x = 30 + rng.float() * 180;
    const y = 40 + rng.float() * 70;
    inked(ctx, rng.pick(['#ff5d8f', '#ffd23f', '#ffffff', '#c77dff']), 2.5, () => starPath(ctx, x, y, 9, 4.5, 5));
    inkEllipse(ctx, x, y, 3, 3, '#ffe066', 0);
  }
  return c;
}

/** Phiên bản mờ xa (cho layer L1). */
export function hazy(src: HTMLCanvasElement, amount = 0.35): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(190,226,250,${amount})`;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------- L3: mặt đường (sân gạch + mép cỏ), tile ngang liền mạch ----------

export function drawGround(): HTMLCanvasElement {
  const W = 512;
  const H = 300;
  const [c, ctx] = makeCanvas(W, H);
  const rng = artRng(41);
  // nền gạch
  ctx.fillStyle = '#d9824a';
  ctx.fillRect(0, 40, W, H - 40);
  const bw = 64;
  for (let r = 0; r < 9; r++) {
    const y = 46 + r * 30;
    const off = (r % 2) * (bw / 2);
    for (let i = -1; i < W / bw + 1; i++) {
      const x = i * bw + off;
      const tone = rng.float();
      ctx.fillStyle = tone < 0.3 ? '#e39058' : tone < 0.6 ? '#cf7440' : '#d9824a';
      ctx.fillRect(x + 2, y + 2, bw - 4, 26);
    }
    ctx.strokeStyle = 'rgba(80,40,20,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    for (let i = -1; i < W / bw + 1; i++) {
      const x = i * bw + off;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 30);
    }
    ctx.stroke();
  }
  // bóng nhẹ phía dưới cho chiều sâu
  const g = ctx.createLinearGradient(0, 40, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,.1)');
  g.addColorStop(1, 'rgba(90,40,10,.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 40, W, H - 40);
  // mép cỏ phía trên (lặp tuần hoàn)
  ctx.fillStyle = '#5cb848';
  ctx.fillRect(0, 0, W, 42);
  const blades: [number, number][] = [];
  for (let i = 0; i < 70; i++) blades.push([rng.float() * W, 6 + rng.float() * 18]);
  for (const [bx, h] of blades) {
    for (const off of [-W, 0, W]) {
      ctx.beginPath();
      ctx.moveTo(bx + off - 6, 46);
      ctx.lineTo(bx + off, 46 + h);
      ctx.lineTo(bx + off + 6, 46);
      ctx.closePath();
      ctx.fillStyle = '#5cb848';
      ctx.fill();
      ctx.strokeStyle = 'rgba(27,26,43,.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#5cb848';
  ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = '#4aa33c';
  ctx.fillRect(0, 0, W, 10);
  return c;
}

// ---------- L4: tiền cảnh ----------

export function drawGrassTuft(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(280, 170);
  const rng = artRng(51);
  for (let i = 0; i < 16; i++) {
    const x = 30 + rng.float() * 220;
    const h = 80 + rng.float() * 80;
    const lean = (rng.float() - 0.5) * 60;
    inked(ctx, i % 2 ? '#3f9e3a' : '#57b84a', 3, () => {
      ctx.moveTo(x - 12, 170);
      ctx.quadraticCurveTo(x + lean * 0.4, 170 - h * 0.6, x + lean, 170 - h);
      ctx.quadraticCurveTo(x + lean * 0.3 + 6, 170 - h * 0.5, x + 12, 170);
      ctx.closePath();
    });
  }
  return c;
}

export function drawFlowers(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(240, 190);
  const rng = artRng(52);
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * 36 + rng.float() * 10;
    const h = 90 + rng.float() * 70;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, 190);
    ctx.quadraticCurveTo(x + 10, 190 - h / 2, x, 190 - h);
    ctx.stroke();
    ctx.strokeStyle = '#3f9e3a';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const col = rng.pick(['#ffffff', '#ffd23f', '#ff5d8f', '#ff8a3d']);
    for (let p = 0; p < 7; p++) {
      const a = (p / 7) * Math.PI * 2;
      inkEllipse(ctx, x + Math.cos(a) * 13, 190 - h + Math.sin(a) * 13, 10, 6, col, 2.5, a);
    }
    inkEllipse(ctx, x, 190 - h, 8, 8, '#ffcf3a', 2.5);
  }
  return c;
}

export function drawFern(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(320, 220);
  for (let f = 0; f < 3; f++) {
    const bx = 80 + f * 80;
    const ang = -1.2 + f * 0.5;
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const x = bx + Math.cos(ang) * 200 * t * 0.6 + t * 40;
      const y = 220 - 200 * t;
      inkEllipse(ctx, x - 14, y, 18 * (1 - t * 0.6), 7, '#3d9a46', 2.5, -0.6);
      inkEllipse(ctx, x + 14, y, 18 * (1 - t * 0.6), 7, '#3d9a46', 2.5, 0.6);
    }
  }
  return c;
}

export function drawLeaf(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(300, 240);
  inked(ctx, '#2f8a33', 5, () => {
    ctx.moveTo(20, 230);
    ctx.bezierCurveTo(40, 80, 200, 0, 290, 20);
    ctx.bezierCurveTo(270, 120, 150, 230, 20, 230);
  });
  ctx.strokeStyle = '#1f5f24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(20, 230);
  ctx.quadraticCurveTo(160, 120, 280, 26);
  ctx.stroke();
  return c;
}

// ---------- Chướng ngại vật (gốc = giữa đáy) ----------

export function drawObstacle(kind: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(220, 160);
  switch (kind) {
    case 'obs_root':
      inked(ctx, TRUNK, 5, () => {
        ctx.moveTo(10, 156);
        ctx.bezierCurveTo(40, 60, 170, 40, 210, 156);
        ctx.lineTo(180, 156);
        ctx.bezierCurveTo(150, 90, 70, 100, 44, 156);
        ctx.closePath();
      });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(50, 110);
      ctx.quadraticCurveTo(100, 76, 150, 92);
      ctx.stroke();
      break;
    case 'obs_rock':
      inked(ctx, '#9a9a9a', 5, () => {
        ctx.moveTo(30, 156);
        ctx.bezierCurveTo(20, 80, 80, 50, 120, 60);
        ctx.bezierCurveTo(180, 60, 200, 110, 190, 156);
        ctx.closePath();
      });
      inked(ctx, '#6fbf4a', 3, () => {
        ctx.moveTo(70, 66);
        ctx.quadraticCurveTo(110, 40, 160, 76);
        ctx.quadraticCurveTo(120, 80, 70, 66);
      });
      inked(ctx, 'rgba(255,255,255,.3)', 0, () => ctx.ellipse(90, 96, 22, 10, -0.5, 0, Math.PI * 2));
      break;
    case 'obs_mushroom':
      inked(ctx, '#fff4dc', 4, () => roundRectPath(ctx, 94, 90, 32, 66, 10));
      inked(ctx, '#e23b2e', 5, () => {
        ctx.moveTo(50, 100);
        ctx.bezierCurveTo(50, 20, 170, 20, 170, 100);
        ctx.quadraticCurveTo(110, 112, 50, 100);
      });
      for (const [x, y, r] of [
        [84, 70, 10],
        [122, 52, 12],
        [146, 84, 8],
      ]) {
        inkEllipse(ctx, x, y, r, r * 0.8, '#ffffff', 2.5);
      }
      break;
    case 'obs_puddle':
      inked(ctx, '#7fc8f0', 4, () => ctx.ellipse(110, 144, 96, 16, 0, 0, Math.PI * 2));
      inked(ctx, 'rgba(255,255,255,.6)', 0, () => ctx.ellipse(80, 140, 30, 4, 0, 0, Math.PI * 2));
      break;
    case 'obs_bucket':
      ctx.save();
      ctx.translate(110, 120);
      ctx.rotate(-1.35);
      inked(ctx, WOOD, 5, () => {
        ctx.moveTo(-40, -50);
        ctx.lineTo(40, -50);
        ctx.lineTo(32, 40);
        ctx.lineTo(-32, 40);
        ctx.closePath();
      });
      inked(ctx, '#7a7a86', 3, () => ctx.rect(-40, -30, 78, 8));
      inked(ctx, '#7a7a86', 3, () => ctx.rect(-36, 18, 70, 8));
      ctx.restore();
      inked(ctx, '#7fc8f0', 3, () => ctx.ellipse(170, 150, 40, 8, 0, 0, Math.PI * 2));
      break;
    default: // obs_post: cọc hàng rào đổ
      ctx.save();
      ctx.translate(110, 132);
      ctx.rotate(-0.12);
      inked(ctx, WOOD, 5, () => {
        ctx.moveTo(-96, -12);
        ctx.lineTo(70, -12);
        ctx.lineTo(94, 0);
        ctx.lineTo(70, 12);
        ctx.lineTo(-96, 12);
        ctx.closePath();
      });
      ctx.strokeStyle = shade(WOOD, -0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-80, -2);
      ctx.lineTo(40, -4);
      ctx.stroke();
      ctx.restore();
      inked(ctx, '#47a447', 3, () => ctx.ellipse(40, 150, 26, 8, 0, 0, Math.PI * 2));
      break;
  }
  return c;
}

export const OBSTACLE_KINDS = ['obs_root', 'obs_rock', 'obs_mushroom', 'obs_puddle', 'obs_bucket', 'obs_post'];

// ---------- Hiệu ứng ----------

export function drawDust(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 96);
  inkBlob(
    ctx,
    [
      [36, 56, 22],
      [56, 44, 24],
      [66, 62, 18],
    ],
    '#f3ead6',
    3,
  );
  return c;
}

export function drawStar(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(56, 56);
  inked(ctx, '#ffd23f', 3.5, () => starPath(ctx, 28, 29, 24, 11, 5));
  return c;
}

export function drawSweat(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(34, 44);
  inked(ctx, '#bfe9ff', 3, () => {
    ctx.moveTo(17, 4);
    ctx.quadraticCurveTo(32, 28, 17, 40);
    ctx.quadraticCurveTo(2, 28, 17, 4);
  });
  return c;
}

export function drawSpeedLine(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(280, 12);
  const g = ctx.createLinearGradient(0, 0, 280, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,.95)');
  ctx.fillStyle = g;
  roundRectPath(ctx, 0, 3, 280, 6, 3);
  ctx.fill();
  return c;
}

export function drawShadow(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(128, 32);
  const g = ctx.createRadialGradient(64, 16, 4, 64, 16, 62);
  g.addColorStop(0, 'rgba(40,20,10,.45)');
  g.addColorStop(1, 'rgba(40,20,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(64, 16, 62, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// ---------- UI (HUD) ----------

export function drawScroll(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(1120, 140);
  const paper = ctx.createLinearGradient(0, 20, 0, 120);
  paper.addColorStop(0, '#fbedc8');
  paper.addColorStop(1, '#ecd29a');
  inked(ctx, paper, 5, () => roundRectPath(ctx, 50, 24, 1020, 92, 10));
  for (const x of [40, 1080]) {
    inked(ctx, '#e6c98c', 5, () => roundRectPath(ctx, x - 24, 12, 48, 116, 22));
    inked(ctx, '#c9a45e', 3, () => ctx.ellipse(x, 70, 10, 50, 0, 0, Math.PI * 2));
    inked(ctx, '#8b5a2b', 4, () => roundRectPath(ctx, x - 8, 2, 16, 136, 8));
  }
  return c;
}

export function drawSign(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(480, 150);
  inked(ctx, '#8b5a2b', 5, () => roundRectPath(ctx, 10, 10, 460, 130, 18));
  inked(ctx, '#b0743b', 3, () => roundRectPath(ctx, 22, 22, 436, 106, 12));
  ctx.strokeStyle = 'rgba(80,40,10,.45)';
  ctx.lineWidth = 3;
  for (const y of [52, 82, 110]) {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.bezierCurveTo(150, y - 6, 300, y + 6, 450, y);
    ctx.stroke();
  }
  for (const [x, y] of [
    [34, 34],
    [446, 34],
    [34, 116],
    [446, 116],
  ]) {
    inkEllipse(ctx, x, y, 6, 6, '#d9d2bf', 2.5);
  }
  return c;
}

/** Nhãn vải trên mũ, rộng `w` px (cache theo độ rộng ở runtime). */
export function drawBanner(w: number): HTMLCanvasElement {
  const h = 62;
  const [c, ctx] = makeCanvas(w, h);
  const notch = 12;
  inked(ctx, '#1d5fc4', 4, () => {
    ctx.moveTo(3, 6);
    ctx.quadraticCurveTo(w / 2, 0, w - 3, 6);
    ctx.lineTo(w - 3 - notch, h / 2);
    ctx.lineTo(w - 3, h - 6);
    ctx.quadraticCurveTo(w / 2, h - 12, 3, h - 6);
    ctx.lineTo(3 + notch, h / 2);
    ctx.closePath();
  });
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(notch + 8, 11);
  ctx.quadraticCurveTo(w / 2, 6, w - notch - 8, 11);
  ctx.moveTo(notch + 8, h - 11);
  ctx.quadraticCurveTo(w / 2, h - 16, w - notch - 8, h - 11);
  ctx.stroke();
  return c;
}
