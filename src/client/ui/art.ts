// Hình cho các màn HTML (Setup, Kết quả, Gallery).
// Ưu tiên asset thật trong public/assets (cắt 1 khung từ sprite sheet bằng CSS background-position);
// nếu manifest chưa có path thì dùng bản vẽ thủ tục của game làm fallback.
import { ASSET_BASE, cachedManifest } from '../game/assets';
import { generateBag } from '../game/art/bagArt';
import { drawHat, drawSmurf, SMURF_ANIMS, SMURF_FRAME } from '../game/art/smurfArt';
import { drawGargamel, GARG_ANIMS, GARG_FRAME } from '../game/art/gargamelArt';
import { makeCanvas } from '../game/art/draw';
import { h } from './dom';

// ---------------------------------------------------------------- fallback thủ tục

let bagCache: Record<string, string[]> | null = null;
function procBag(key: string): string[] {
  if (!bagCache) {
    const b = generateBag();
    bagCache = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.map((c) => c.toDataURL())]));
  }
  return bagCache[key] ?? [];
}

const procCache = new Map<string, string>();
function procSprite(key: string, frame: number): string | null {
  const ck = `${key}:${frame}`;
  const hit = procCache.get(ck);
  if (hit) return hit;
  let url: string | null = null;
  if (SMURF_ANIMS[key]) {
    const [c, ctx] = makeCanvas(SMURF_FRAME, SMURF_FRAME);
    const pose = SMURF_ANIMS[key].frames[Math.min(frame, SMURF_ANIMS[key].frames.length - 1)];
    const r = drawSmurf(ctx, pose);
    ctx.save();
    ctx.translate(r.head[0], r.head[1]);
    ctx.rotate(r.head[2]);
    ctx.translate(-130, -110);
    ctx.drawImage(drawHat(), 0, 0);
    ctx.restore();
    url = c.toDataURL();
  } else if (GARG_ANIMS[key]) {
    const [c, ctx] = makeCanvas(GARG_FRAME, GARG_FRAME);
    drawGargamel(ctx, GARG_ANIMS[key].frames[Math.min(frame, GARG_ANIMS[key].frames.length - 1)]);
    url = c.toDataURL();
  } else if (key.startsWith('bag_')) {
    url = procBag(key)[frame] ?? null;
  }
  if (url) procCache.set(ck, url);
  return url;
}

// ---------------------------------------------------------------- asset thật

export interface FrameStyle {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
}

/** Style CSS hiển thị khung `frame` của sprite `key` (null nếu chưa có asset thật). */
export function realFrameStyle(key: string, frame: number, variant?: string): FrameStyle | null {
  const s = cachedManifest()?.sprites[key];
  if (!s?.path) return null;
  const path = (variant && s.variants?.[variant]) || s.path;
  const n = Math.max(1, s.frames);
  const f = Math.max(0, Math.min(n - 1, frame));
  return {
    backgroundImage: `url("${ASSET_BASE}${path}")`,
    backgroundSize: `${n * 100}% 100%`,
    backgroundPosition: `${n > 1 ? (f / (n - 1)) * 100 : 0}% 0%`,
  };
}

/** Số khung của sprite (theo manifest, hoặc bản thủ tục). */
export function frameCount(key: string): number {
  const s = cachedManifest()?.sprites[key];
  if (s?.path) return s.frames;
  if (key.startsWith('bag_')) return procBag(key).length;
  return SMURF_ANIMS[key]?.frames.length ?? GARG_ANIMS[key]?.frames.length ?? 1;
}

/** Biến thể nhân vật sinh viên có trong art (rỗng nếu dùng placeholder). */
export function kidVariants(): string[] {
  return Object.keys(cachedManifest()?.sprites.smurf_run?.variants ?? {});
}

/** Phần tử hiển thị 1 khung hình; có thể đổi khung sau bằng `setSpriteFrame`. */
export function spriteEl(key: string, frame: number, cls: string, variant?: string, alt = ''): HTMLElement {
  const el = h('div', { class: `sprite ${cls}`, role: alt ? 'img' : undefined, 'aria-label': alt || undefined, 'aria-hidden': alt ? undefined : 'true' });
  el.dataset.key = key;
  if (variant) el.dataset.variant = variant;
  setSpriteFrame(el, frame);
  return el;
}

export function setSpriteFrame(el: HTMLElement, frame: number, key = el.dataset.key ?? '') {
  el.dataset.key = key;
  const st = realFrameStyle(key, frame, el.dataset.variant);
  if (st) {
    Object.assign(el.style, st);
    return;
  }
  const url = procSprite(key, frame);
  Object.assign(el.style, {
    backgroundImage: url ? `url("${url}")` : '',
    backgroundSize: '100% 100%',
    backgroundPosition: '0 0',
  });
}
