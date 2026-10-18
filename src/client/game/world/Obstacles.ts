// Chướng ngại vật trên mặt đường: rễ cây, đá, nấm, vũng nước, xô gỗ, cọc hàng rào đổ.
// Anchor và hitbox đọc từ manifest (sinh từ art/sprites/props.json).
import Phaser from 'phaser';
import type { ChaChaRng } from '@shared/rng';
import type { AssetRegistry } from '../assets';
import { DEPTH, OBSTACLE_SCALE, OBSTACLE_SCALE_PROC, OBSTACLE_Y, W } from '../config';

export const OBSTACLE_KEYS = ['obs_root', 'obs_rock', 'obs_mushroom', 'obs_puddle', 'obs_bucket', 'obs_post'];

export interface Obstacle {
  id: number;
  img: Phaser.GameObjects.Image;
  /** toạ độ điểm neo (giữa đáy) */
  x: number;
  prevX: number;
  /** mép trái / phải của hitbox so với x (px màn hình) */
  left: number;
  right: number;
  /** id SV được kịch bản cho vấp vào chướng ngại này (nếu có) */
  forStudent: number | null;
  /** chướng ngại dành cho Gargamel vấp */
  forGargamel: boolean;
  /** điều chỉnh để mép trái hitbox tới đúng vị trí đích vào đúng thời điểm */
  aim: { x: number; t: number } | null;
  handled: Set<number>;
}

export class Obstacles {
  readonly list: Obstacle[] = [];
  private nextAuto = 3.5;
  private lastSpawnT = -10;
  private seq = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: ChaChaRng,
    private readonly assets: AssetRegistry,
  ) {}

  /** Hình học của chướng ngại: anchor, scale và hitbox (mép trái/phải so với điểm neo). */
  geometry(key: string) {
    const real = this.assets.hasReal(key);
    const spec = this.assets.image(key);
    const anchor: [number, number] = (real && spec?.anchor) || [0.5, 1];
    const scale = real ? OBSTACLE_SCALE : OBSTACLE_SCALE_PROC;
    const src = this.scene.textures.get(key).getSourceImage() as { width: number; height: number };
    const hb = real && spec?.hitbox ? spec.hitbox : [src.width * 0.15, 0, src.width * 0.7, src.height];
    const ox = anchor[0] * src.width;
    return { anchor, scale, left: (hb[0] - ox) * scale, right: (hb[0] + hb[2] - ox) * scale };
  }

  /** `aim.x` là vị trí mong muốn của MÉP TRÁI hitbox tại thời điểm `aim.t`. */
  spawn(key: string, x: number, opts: Partial<Pick<Obstacle, 'forStudent' | 'forGargamel' | 'aim'>> = {}) {
    const g = this.geometry(key);
    const img = this.scene.add
      .image(x, OBSTACLE_Y, key)
      .setOrigin(g.anchor[0], g.anchor[1])
      .setScale(g.scale)
      .setDepth(DEPTH.actors + OBSTACLE_Y - 20);
    const o: Obstacle = {
      id: this.seq++,
      img,
      x,
      prevX: x,
      left: g.left,
      right: g.right,
      forStudent: opts.forStudent ?? null,
      forGargamel: opts.forGargamel ?? false,
      aim: opts.aim ? { x: opts.aim.x - g.left, t: opts.aim.t } : null,
      handled: new Set(),
    };
    this.list.push(o);
    return o;
  }

  /** Spawn theo nhịp, không sát nhau quá. */
  auto(t: number, quiet: boolean) {
    if (t < this.nextAuto) return;
    this.nextAuto = t + this.rng.range(2.4, 4.6);
    if (quiet || t - this.lastSpawnT < 1.6) return;
    this.spawn(this.rng.pick(OBSTACLE_KEYS), W + 200);
    this.lastSpawnT = t;
  }

  markSpawn(t: number) {
    this.lastSpawnT = t;
  }

  update(t: number, dt: number, ws: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.prevX = o.x;
      let v = ws;
      if (o.aim && t < o.aim.t) {
        // bù sai số để chạm đúng mục tiêu tại thời điểm kịch bản
        const need = (o.x - o.aim.x) / Math.max(0.05, o.aim.t - t);
        v = Phaser.Math.Clamp(need, ws * 0.7, ws * 1.3);
      }
      o.x -= v * dt;
      o.img.x = o.x;
      if (o.x + o.right < -60) {
        o.img.destroy();
        this.list.splice(i, 1);
      }
    }
  }
}
