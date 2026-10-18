// Nhập bộ asset chính thức từ art/ (do model vẽ) sang public/assets/ và SINH manifest.json.
// Không sửa gì trong art/. Chạy lại được từ đầu: npm run import:art
//
// - Nền 5 lớp, chướng ngại vật (kèm hitbox), túi (cắt khung 512 → 256), fx, ui.
// - Kid (5 biến thể) thay smurf_*, wizard thay gargamel_* — giữ nguyên key mà code dùng.
// - Mọi thông số (frame, fps, anchor, track, hitbox, bbox) lấy từ art/sprites/*.json.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const ART = 'art';
const SP = `${ART}/sprites`;
const OUT = 'public/assets';
const MANIFEST = `${OUT}/manifest.json`;
for (const d of ['bg', 'obstacles', 'sprites', 'fx', 'ui']) mkdirSync(`${OUT}/${d}`, { recursive: true });

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const kid = readJson(`${SP}/kid_sprites.json`);
const wiz = readJson(`${SP}/wizard_sprites.json`);
const props = readJson(`${SP}/props.json`);
const manifest = readJson(MANIFEST);
const rad = (deg) => Math.round(((deg * Math.PI) / 180) * 10000) / 10000;
const r1 = (v) => Math.round(v * 10) / 10;
const pngSize = (f) => {
  const p = PNG.sync.read(readFileSync(f));
  return { width: p.width, height: p.height, png: p };
};
/** Khung bao vùng có alpha > 8 (để cắt nine-slice cho UI). */
function alphaBBox(png) {
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
const copy = (src, dst) => {
  copyFileSync(src, `${OUT}/${dst}`);
  return dst;
};
let count = 0;

// ---------------------------------------------------------------- nền
for (let i = 0; i < 5; i++) {
  const path = copy(`${ART}/sgu_bg_L${i}.png`, `bg/sgu_bg_L${i}.png`);
  manifest.backgrounds[`bg_l${i}`] = { ...manifest.backgrounds[`bg_l${i}`], path, width: 3840, height: 1080 };
  count++;
}

// ---------------------------------------------------------------- kid → smurf_*
const KID_MAP = { run: 'smurf_run', trip: 'smurf_trip', getup: 'smurf_getup', jump: 'smurf_jump', struggle: 'smurf_struggle', pop: 'smurf_escape_pop' };
const kf = kid.frame;
for (const [anim, key] of Object.entries(KID_MAP)) {
  const a = kid.anims[anim];
  const variants = {};
  for (const v of kid.variants) {
    const file = v === 'base' ? `kid_${anim}.png` : `kid_${anim}_${v}.png`;
    variants[v] = copy(`${SP}/${file}`, `sprites/${file}`);
    count++;
  }
  const { width } = pngSize(`${SP}/kid_${anim}.png`);
  if (width / kf !== a.frames) throw new Error(`kid_${anim}: ${width / kf} khung, json ghi ${a.frames}`);
  manifest.sprites[key] = {
    path: variants.base,
    variants,
    frameWidth: kf,
    frameHeight: kf,
    frames: a.frames,
    fps: a.fps,
    loop: a.loop,
    anchor: [0.5, kid.groundY / kf],
    // headTrack = tâm miếng vải trên mũ (x, y, góc rad) — băng rôn tên, mồ hôi, sao bám theo
    headTrack: a.frameData.map((f) => [r1(f.label.x), r1(f.label.y), rad(f.label.angle)]),
    labelOffset: [0, 0],
    ...(a.frameData.some((f) => f.dy !== undefined) ? { dyTrack: a.frameData.map((f) => f.dy ?? 0) } : {}),
    ...(a.frameData.some((f) => f.grip) ? { gripTrack: a.frameData.map((f) => (f.grip ? [r1(f.grip.x), r1(f.grip.y)] : null)) } : {}),
    bakedHat: true,
    noTint: true,
  };
}

// ---------------------------------------------------------------- wizard → gargamel_*
const WIZ_MAP = { run: 'gargamel_run', lunge: 'gargamel_lunge', fall: 'gargamel_miss_fall', stomp: 'gargamel_angry' };
const wf = wiz.frame;
// Túi vẽ sẵn trong tay phù thủy (đo từ art: thân túi dài ~113px, rộng ~91px khi bán kính miệng r=37;
// cổ túi nằm đúng tại tâm miệng). Lưu theo bội số của r để khi đổi art chỉ cần sửa 2 số này.
// Dùng để đè túi "có người đang giãy" (bag_wriggle) khít lên túi vẽ sẵn.
const SACK_OVERLAY = [3.5, 3.9]; // [rộng, dài] / r (túi vẽ sẵn đo được 2.5 x 3.1; đè to hơn ~40% để che kín viền và cổ túi cũ)
for (const [anim, key] of Object.entries(WIZ_MAP)) {
  const a = wiz.anims[anim];
  const path = copy(`${SP}/wizard_${anim}.png`, `sprites/wizard_${anim}.png`);
  count++;
  const { width } = pngSize(`${SP}/wizard_${anim}.png`);
  if (width / wf !== a.frames) throw new Error(`wizard_${anim}: ${width / wf} khung, json ghi ${a.frames}`);
  // handTrack = miệng túi (x, y, hướng miệng rad). Khung "sackFull" giữ vị trí miệng của khung trước.
  let last = null;
  const handTrack = a.frameData.map((f) => {
    if (f.sackMouth) last = [r1(f.sackMouth.x), r1(f.sackMouth.y), rad(f.sackMouth.facing)];
    return last;
  });
  for (let i = 0; i < handTrack.length; i++) if (!handTrack[i]) handTrack[i] = handTrack.find(Boolean);
  const sackFull = a.frameData.map((f, i) => (f.sackFull ? i : -1)).filter((i) => i >= 0);
  // catchFrame = khung "miệng túi mở chạm mục tiêu": trong các khung trước khung túi đầy,
  // lấy khung có miệng túi hướng ngang nhất (|facing| nhỏ nhất; hoà thì lấy khung sau).
  let catchFrame;
  if (sackFull.length) {
    let best = Infinity;
    a.frameData.slice(0, sackFull[0]).forEach((f, i) => {
      if (f.sackMouth && Math.abs(f.sackMouth.facing) <= best) {
        best = Math.abs(f.sackMouth.facing);
        catchFrame = i;
      }
    });
  }
  manifest.sprites[key] = {
    path,
    frameWidth: wf,
    frameHeight: wf,
    frames: a.frames,
    fps: a.fps,
    loop: a.loop,
    anchor: [0.5, wiz.groundY / wf],
    handTrack,
    sackRadius: a.frameData.find((f) => f.sackMouth)?.sackMouth.r ?? 34,
    bagInHand: true,
    sackOverlay: SACK_OVERLAY,
    ...(sackFull.length ? { sackFull, slamFrame: sackFull[0], catchFrame } : {}),
  };
}

// ---------------------------------------------------------------- túi: cắt khung 512 → 256 (x128..384, y256..512)
const BAG_CROP = { x: 128, y: 256, size: 256 };
const BAG_MAP = { sack_idle: 'bag_idle', sack_wriggle: 'bag_wriggle', sack_open: 'bag_open' };
for (const [name, key] of Object.entries(BAG_MAP)) {
  const { png: src } = pngSize(`${SP}/${name}.png`);
  const frames = src.width / props.frame;
  const dst = new PNG({ width: frames * BAG_CROP.size, height: BAG_CROP.size });
  for (let f = 0; f < frames; f++) PNG.bitblt(src, dst, f * props.frame + BAG_CROP.x, BAG_CROP.y, BAG_CROP.size, BAG_CROP.size, f * BAG_CROP.size, 0);
  writeFileSync(`${OUT}/sprites/${name}.png`, PNG.sync.write(dst));
  // điểm treo = đỉnh nút buộc (hàng có alpha đầu tiên ở giữa khung đầu)
  const bb = alphaBBox(PNG.sync.read(PNG.sync.write(dst)));
  // kích thước thân túi ở khung đầu (px trong khung 256) để scale khít lên túi vẽ sẵn
  const first = new PNG({ width: BAG_CROP.size, height: BAG_CROP.size });
  PNG.bitblt(dst, first, 0, 0, BAG_CROP.size, BAG_CROP.size, 0, 0);
  const fb = alphaBBox(first);
  const p = props.assets[name];
  manifest.sprites[key] = {
    path: `sprites/${name}.png`,
    frameWidth: BAG_CROP.size,
    frameHeight: BAG_CROP.size,
    frames: frames,
    fps: p.fps ?? 10,
    loop: p.loop ?? false,
    anchor: [0.5, (props.groundY - BAG_CROP.y) / BAG_CROP.size],
    grip: [128, bb ? Math.max(0, bb[1] + 4) : 40],
    // [rộng, dài] của thân túi tính từ cổ (grip) xuống đáy
    bagSize: fb ? [fb[2], fb[1] + fb[3] - (bb ? Math.max(0, bb[1] + 4) : 40)] : [190, 210],
  };
  count++;
}

// ---------------------------------------------------------------- chướng ngại vật (kèm hitbox)
for (const k of ['root', 'rock', 'mushroom', 'puddle', 'bucket', 'post']) {
  const path = copy(`${SP}/obj_${k}.png`, `obstacles/obj_${k}.png`);
  const hb = props.assets[`obj_${k}`].hitbox;
  manifest.images[`obs_${k}`] = {
    path,
    width: props.frame,
    height: props.frame,
    anchor: [0.5, props.groundY / props.frame],
    hitbox: [hb.x, hb.y, hb.w, hb.h],
  };
  count++;
}

// ---------------------------------------------------------------- hiệu ứng (sprite nhiều khung)
const FX_MAP = { fx_dust: 'fx_dust', fx_starburst: 'fx_star', fx_speedlines: 'fx_speed' };
for (const [name, key] of Object.entries(FX_MAP)) {
  const path = copy(`${SP}/${name}.png`, `fx/${name}.png`);
  const p = props.assets[name];
  delete manifest.images[key];
  manifest.sprites[key] = {
    path,
    frameWidth: props.frame,
    frameHeight: props.frame,
    frames: p.frames,
    fps: p.fps ?? 12,
    loop: p.loop ?? false,
    anchor: p.anchor === 'bottom-center' ? [0.5, props.groundY / props.frame] : [0.5, 0.5],
  };
  count++;
}

// ---------------------------------------------------------------- UI
for (const name of ['ui_scroll', 'ui_scroll_fill', 'ui_scroll_marker', 'ui_button', 'ui_button_pressed']) {
  const path = copy(`${SP}/${name}.png`, `ui/${name}.png`);
  const { png } = pngSize(`${SP}/${name}.png`);
  const p = props.assets[name];
  manifest.images[name] = {
    path,
    width: png.width,
    height: png.height,
    bbox: alphaBBox(png),
    ...(p.track ? { track: [p.track.x, p.track.y, p.track.w, p.track.h] } : {}),
    ...(p.label ? { label: [p.label.x, p.label.y, p.label.w, p.label.h] } : {}),
  };
  count++;
}

manifest._art = {
  source: 'art/ (model vẽ asset). Sinh tự động bởi scripts/import-art.mjs — đừng sửa tay các mục có path.',
  kidVariants: kid.variants,
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
if (!existsSync(MANIFEST)) throw new Error('Không ghi được manifest');
console.log(`Đã nhập ${count} file từ art/ và cập nhật ${MANIFEST}`);
