/**
 * Quản lý asset qua public/assets/manifest.json.
 *
 * - Mục nào có "path" sẽ được nạp từ file thật (PNG sprite sheet / atlas / ảnh nền).
 * - Mục nào thiếu "path" (hoặc nạp lỗi) sẽ dùng placeholder vẽ thủ tục trong ./art.
 * Nhờ vậy thay asset thật chỉ cần thả file đúng tên và điền "path" trong manifest, không sửa code.
 */
import Phaser from 'phaser';
import { generateSmurfAnims, drawHat, SMURF_ACCESSORIES, SMURF_FRAME, SMURF_HEAD, SMURF_BODY, type Track } from './art/smurfArt';
import { generateGargamelAnims, GARG_FRAME } from './art/gargamelArt';
import { generateBag, BAG_FRAME, BAG_GRIP } from './art/bagArt';
import { drawSguBuilding } from './art/buildingArt';
import * as P from './art/propsArt';
import { sheet } from './art/draw';

export interface SpriteSpec {
  path?: string | null;
  /** sheet toàn thân cho từng biến thể nhân vật (vd. kid đeo kính, mang balo…) */
  variants?: Record<string, string>;
  atlas?: string;
  prefix?: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  loop?: boolean;
  anchor?: [number, number];
  headTrack?: Track[];
  bodyTrack?: Track[];
  handTrack?: Track[];
  /** độ lệch băng rôn tên so với headTrack (px khung) */
  labelOffset?: [number, number];
  /** nhân vật đã vẽ sẵn mũ/phụ kiện trong thân → tắt mũ rời & overlay phụ kiện */
  bakedHat?: boolean;
  /** không tô tint lên thân (art thật) */
  noTint?: boolean;
  /** túi vẽ sẵn trong tay nhân vật → ẩn sprite túi rời */
  bagInHand?: boolean;
  /** các khung túi đã khép (có người bên trong) */
  sackFull?: number[];
  /** khung túi chụp xuống trong hoạt cảnh vồ */
  slamFrame?: number;
  sackRadius?: number;
  /** điểm treo túi (chỉ cho bag_*) */
  grip?: [number, number];
}

export interface ImageSpec {
  path?: string | null;
  width?: number;
  height?: number;
  anchor?: [number, number];
  scroll?: number;
  /** [x, y, w, h] trong khung ảnh */
  hitbox?: [number, number, number, number];
  bbox?: [number, number, number, number];
  track?: [number, number, number, number];
  label?: [number, number, number, number];
}

export interface AudioSpec {
  path: string;
  loop?: boolean;
  volume?: number;
  start?: number;
  maxDuration?: number;
}

export interface Manifest {
  version: number;
  atlases?: { key: string; texture: string; atlas: string }[];
  sprites: Record<string, SpriteSpec>;
  images: Record<string, ImageSpec>;
  backgrounds: Record<string, ImageSpec>;
  audio: Record<string, AudioSpec>;
}

export interface AnimDef {
  key: string;
  texture: string;
  /** biến thể → key texture (chỉ có khi dùng art thật) */
  variants: Record<string, string>;
  frames: (string | number)[];
  fps: number;
  loop: boolean;
  /** cạnh khung (vuông) — dùng để quy đổi track */
  frameSize: number;
  frameW: number;
  frameH: number;
  anchor: [number, number];
  real: boolean;
  head?: Track[];
  body?: Track[];
  hand?: Track[];
  labelOffset: [number, number];
  bakedHat: boolean;
  noTint: boolean;
  bagInHand: boolean;
  sackFull: number[];
  slamFrame?: number;
}

let manifestCache: Manifest | null = null;

export async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch('/assets/manifest.json', { cache: 'no-cache' });
  manifestCache = (await res.json()) as Manifest;
  return manifestCache;
}

/** Manifest đã nạp (đồng bộ) — null nếu chưa gọi loadManifest(). */
export function cachedManifest(): Manifest | null {
  return manifestCache;
}

export const ASSET_BASE = '/assets/';
const BASE = ASSET_BASE;
export const variantKey = (key: string, variant: string) => `${key}@${variant}`;

/** Đưa các file thật vào hàng đợi loader của Phaser. */
export function queueRealAssets(scene: Phaser.Scene, m: Manifest) {
  for (const a of m.atlases ?? []) scene.load.atlas(a.key, BASE + a.texture, BASE + a.atlas);
  for (const [key, s] of Object.entries(m.sprites)) {
    if (s.path && !s.atlas) {
      const cfg = { frameWidth: s.frameWidth, frameHeight: s.frameHeight };
      scene.load.spritesheet(key, BASE + s.path, cfg);
      for (const [v, path] of Object.entries(s.variants ?? {})) {
        if (path !== s.path) scene.load.spritesheet(variantKey(key, v), BASE + path, cfg);
      }
    }
  }
  for (const [key, s] of [...Object.entries(m.images), ...Object.entries(m.backgrounds)]) {
    if (s.path) scene.load.image(key, BASE + s.path);
  }
}

type Gen = { frames: HTMLCanvasElement[]; fps: number; loop: boolean; head?: Track[]; body?: Track[]; hand?: Track[] };

export class AssetRegistry {
  readonly anims = new Map<string, AnimDef>();
  readonly real = new Set<string>();
  readonly imageAnchor = new Map<string, [number, number]>();
  bagGrip: [number, number] = [BAG_GRIP[0] / BAG_FRAME, BAG_GRIP[1] / BAG_FRAME];

  constructor(
    private readonly scene: Phaser.Scene,
    readonly manifest: Manifest,
  ) {}

  anim(key: string): AnimDef {
    const a = this.anims.get(key);
    if (!a) throw new Error(`Thiếu animation ${key}`);
    return a;
  }

  hasReal(key: string) {
    return this.real.has(key);
  }

  image(key: string): ImageSpec | undefined {
    return this.manifest.images[key];
  }

  /** Danh sách biến thể nhân vật sinh viên (rỗng nếu đang dùng placeholder). */
  get kidVariants(): string[] {
    return Object.keys(this.anims.get('smurf_run')?.variants ?? {});
  }

  private addCanvasSheet(key: string, frames: HTMLCanvasElement[], fw: number, fh: number) {
    const cols = Math.min(4, frames.length);
    const tex = this.scene.textures.addCanvas(key, sheet(frames, fw, fh, cols))!;
    frames.forEach((_, i) => tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
  }

  private addCanvasImage(key: string, canvas: HTMLCanvasElement) {
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, canvas);
  }

  /** Tạo animation & placeholder cho mọi mục chưa có asset thật. */
  build() {
    const tx = this.scene.textures;
    const m = this.manifest;
    const isLoaded = (key: string, s: SpriteSpec) =>
      s.atlas ? tx.exists(s.atlas) : Boolean(s.path) && tx.exists(key);

    // placeholder thủ tục chỉ sinh khi cần
    let smurfGen: Record<string, Gen> | null = null;
    let gargGen: Record<string, Gen> | null = null;
    let bagGen: Record<string, HTMLCanvasElement[]> | null = null;
    const genFor = (key: string): { g: Gen; size: [number, number] } | null => {
      if (key.startsWith('smurf_')) {
        smurfGen ??= generateSmurfAnims();
        return smurfGen[key] ? { g: smurfGen[key], size: [SMURF_FRAME, SMURF_FRAME] } : null;
      }
      if (key.startsWith('gargamel_')) {
        gargGen ??= generateGargamelAnims();
        return gargGen[key] ? { g: gargGen[key], size: [GARG_FRAME, GARG_FRAME] } : null;
      }
      if (key.startsWith('bag_')) {
        bagGen ??= generateBag();
        const frames = bagGen[key];
        return frames ? { g: { frames, fps: 8, loop: key === 'bag_wriggle' }, size: [BAG_FRAME, BAG_FRAME] } : null;
      }
      const fx: Record<string, () => HTMLCanvasElement> = { fx_dust: P.drawDust, fx_star: P.drawStar, fx_speed: P.drawSpeedLine };
      if (fx[key]) {
        const c = fx[key]();
        return { g: { frames: [c], fps: 1, loop: false }, size: [c.width, c.height] };
      }
      return null;
    };

    const specs: Record<string, SpriteSpec> = { ...m.sprites };
    for (const k of ['fx_dust', 'fx_star', 'fx_speed']) specs[k] ??= { frameWidth: 0, frameHeight: 0, frames: 1, fps: 1 };

    for (const [key, s] of Object.entries(specs)) {
      const loaded = isLoaded(key, s);
      let def: AnimDef;
      const base = {
        key,
        labelOffset: [0, 0] as [number, number],
        bakedHat: false,
        noTint: false,
        bagInHand: false,
        sackFull: [] as number[],
        variants: {} as Record<string, string>,
      };
      if (loaded) {
        this.real.add(key);
        const frames: (string | number)[] = s.atlas
          ? Array.from({ length: s.frames }, (_, i) => `${s.prefix ?? key + '_'}${i}`)
          : Array.from({ length: s.frames }, (_, i) => i);
        const variants: Record<string, string> = {};
        for (const [v, path] of Object.entries(s.variants ?? {})) {
          const vk = path === s.path ? key : variantKey(key, v);
          if (tx.exists(vk)) variants[v] = vk;
        }
        def = {
          ...base,
          texture: s.atlas ?? key,
          variants,
          frames,
          fps: s.fps,
          loop: s.loop ?? false,
          frameSize: s.frameHeight,
          frameW: s.frameWidth,
          frameH: s.frameHeight,
          anchor: s.anchor ?? [0.5, 1],
          real: true,
          head: s.headTrack,
          body: s.bodyTrack,
          hand: s.handTrack,
          labelOffset: s.labelOffset ?? [0, 0],
          bakedHat: s.bakedHat ?? false,
          noTint: s.noTint ?? false,
          bagInHand: s.bagInHand ?? false,
          sackFull: s.sackFull ?? [],
          slamFrame: s.slamFrame,
        };
      } else {
        const gen = genFor(key);
        if (!gen) continue;
        const [fw, fh] = gen.size;
        this.addCanvasSheet(key, gen.g.frames, fw, fh);
        def = {
          ...base,
          texture: key,
          frames: gen.g.frames.map((_, i) => i),
          fps: s.fps ?? gen.g.fps,
          loop: s.loop ?? gen.g.loop,
          frameSize: fh,
          frameW: fw,
          frameH: fh,
          anchor: key === 'fx_dust' ? [0.5, 0.75] : key.startsWith('fx_') ? [0.5, 0.5] : [0.5, 1],
          real: false,
          head: gen.g.head,
          body: gen.g.body,
          hand: gen.g.hand,
          // băng rôn đặt phía trên tâm đầu (tư thế chuẩn của bản vẽ thủ tục)
          labelOffset: key.startsWith('smurf_') ? [-4, -64] : [0, 0],
          slamFrame: key === 'gargamel_lunge' ? 3 : undefined,
        };
      }
      if (key.startsWith('bag_') && s.grip && loaded) this.bagGrip = [s.grip[0] / s.frameWidth, s.grip[1] / s.frameHeight];
      this.anims.set(key, def);
    }

    // Ảnh đơn: mũ, phụ kiện, chướng ngại vật, hiệu ứng, UI (+ cảnh vật nếu thiếu nền thật)
    const procedural: Record<string, () => HTMLCanvasElement> = {
      smurf_hat: drawHat,
      ...Object.fromEntries(Object.entries(SMURF_ACCESSORIES).map(([k, v]) => [k, v.draw])),
      fx_sweat: P.drawSweat,
      fx_shadow: P.drawShadow,
      ui_scroll: P.drawScroll,
      ui_sign: P.drawSign,
      bg_sky: P.drawSky,
      ...Object.fromEntries(P.OBSTACLE_KINDS.map((k) => [k, () => P.drawObstacle(k)])),
    };
    const needL = (i: number) => !(m.backgrounds[`bg_l${i}`]?.path && tx.exists(`bg_l${i}`));
    if (needL(0)) Object.assign(procedural, { bg_clouds: P.drawClouds, bg_hills: P.drawHills });
    if (needL(1)) Object.assign(procedural, { prop_sgu: drawSguBuilding });
    if (needL(1) || needL(2))
      Object.assign(procedural, {
        prop_banyan: P.drawBanyan,
        prop_tree: P.drawRoundTree,
        prop_house_red: () => P.drawMushroomHouse('#e23b2e', '#ffffff'),
        prop_house_blue: () => P.drawMushroomHouse('#3d7fe0', '#dff0ff'),
        prop_house_orange: () => P.drawMushroomHouse('#ff8f2e', '#ffe26b'),
        prop_house_pink: () => P.drawMushroomHouse('#ef6fa8', '#ffffff'),
        prop_fence: P.drawFence,
        prop_bench: P.drawBench,
        prop_well: P.drawWell,
        prop_lamp: P.drawLamp,
        prop_bush: P.drawBush,
      });
    if (needL(3)) Object.assign(procedural, { bg_ground: P.drawGround });
    if (needL(4)) Object.assign(procedural, { fg_grass: P.drawGrassTuft, fg_flowers: P.drawFlowers, fg_fern: P.drawFern, fg_leaf: P.drawLeaf });

    for (const [key, fn] of Object.entries(procedural)) {
      const spec = m.images[key];
      if (spec?.path && tx.exists(key)) {
        this.real.add(key);
        if (spec.anchor) this.imageAnchor.set(key, spec.anchor);
      } else {
        this.addCanvasImage(key, fn());
        // anchor/hitbox trong manifest mô tả file thật; bản thủ tục dùng gốc (0.5, 1)
      }
    }
    for (const key of ['ui_scroll_fill', 'ui_scroll_marker', 'ui_button', 'ui_button_pressed']) {
      if (m.images[key]?.path && tx.exists(key)) this.real.add(key);
    }
    if (needL(1)) {
      // bản mờ xa cho layer L1
      for (const k of ['prop_tree', 'prop_house_red', 'prop_house_blue', 'prop_banyan']) {
        const src = tx.get(k).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
        const c = document.createElement('canvas');
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d')!.drawImage(src, 0, 0);
        this.addCanvasImage(`${k}_far`, P.hazy(c, 0.4));
      }
    }
    for (const [key, s] of Object.entries(m.backgrounds)) if (s.path && tx.exists(key)) this.real.add(key);
  }

  /** Lấy (hoặc tạo) texture nhãn vải theo độ rộng. */
  banner(width: number): string {
    const w = Math.max(90, Math.ceil(width / 16) * 16);
    const key = `ui_banner_${w}`;
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, P.drawBanner(w));
    return key;
  }
}

export const SMURF_HEAD_ORIGIN: [number, number] = [SMURF_HEAD[0] / SMURF_FRAME, SMURF_HEAD[1] / SMURF_FRAME];
export const SMURF_BODY_ORIGIN: [number, number] = [SMURF_BODY[0] / SMURF_FRAME, SMURF_BODY[1] / SMURF_FRAME];
