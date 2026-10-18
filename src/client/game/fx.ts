// Hiệu ứng: bụi, sao/starburst, vệt tốc độ. (Chỉ để trang trí — không ảnh hưởng kết quả.)
// Dùng sprite nhiều khung từ manifest (fx_dust, fx_star, fx_speed); thiếu file thì dùng bản thủ tục.
import Phaser from 'phaser';
import type { ChaChaRng } from '@shared/rng';
import type { AnimDef, AssetRegistry } from './assets';
import { DEPTH, H, W } from './config';

export class Fx {
  private readonly dustDef: AnimDef;
  private readonly starDef: AnimDef;
  private readonly speedDef: AnimDef;
  private speedOverlay: Phaser.GameObjects.Sprite | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: ChaChaRng,
    private readonly reduceMotion: boolean,
    assets: AssetRegistry,
  ) {
    this.dustDef = assets.anim('fx_dust');
    this.starDef = assets.anim('fx_star');
    this.speedDef = assets.anim('fx_speed');
  }

  /** Tạo sprite chạy hết các khung trong `duration` ms rồi tự huỷ. */
  private playOnce(def: AnimDef, x: number, y: number, scale: number, duration: number, extra: Phaser.Types.Tweens.TweenBuilderConfig | object = {}) {
    const sp = this.scene.add.sprite(x, y, def.texture, def.frames[0]).setOrigin(def.anchor[0], def.anchor[1]).setDepth(DEPTH.fx).setScale(scale);
    const n = def.frames.length;
    const state = { u: 0 };
    this.scene.tweens.add({
      targets: state,
      u: 1,
      duration,
      onUpdate: () => sp.setFrame(def.frames[Math.min(n - 1, Math.floor(state.u * n))]),
    });
    this.scene.tweens.add({ targets: sp, duration, ...extra, onComplete: () => sp.destroy() });
    return sp;
  }

  dust(x: number, y: number, count = 4, size = 1) {
    const d = this.dustDef;
    if (d.real) {
      // khung bụi thật đã có nhiều cụm → 1–2 sprite là đủ
      const k = (0.42 * size * 512) / d.frameH;
      const m = Math.min(2, Math.max(1, Math.round(count / 3)));
      for (let i = 0; i < m; i++) {
        this.playOnce(d, x + this.rng.range(-25, 25) * size, y, k * this.rng.range(0.85, 1.1), this.rng.range(420, 560), {
          x: x + this.rng.range(-60, 0) * size,
          alpha: { from: 1, to: 0.3 },
        });
      }
      return;
    }
    for (let i = 0; i < count; i++) {
      const img = this.scene.add
        .image(x + this.rng.range(-30, 30) * size, y - this.rng.range(0, 20), d.texture, d.frames[0])
        .setDepth(DEPTH.fx)
        .setScale(0.3 * size)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: img,
        x: img.x + this.rng.range(-70, 20) * size,
        y: img.y - this.rng.range(10, 50) * size,
        scale: this.rng.range(0.7, 1.1) * size,
        alpha: 0,
        duration: this.rng.range(450, 750),
        ease: 'Quad.easeOut',
        onComplete: () => img.destroy(),
      });
    }
  }

  stars(x: number, y: number, count = 7) {
    const s = this.starDef;
    if (s.real) {
      // starburst thật: 1 vụ nổ bung ra rồi mờ dần
      const k = (0.5 * 512) / s.frameH;
      const sp = this.scene.add.sprite(x, y, s.texture, s.frames[0]).setOrigin(0.5, 0.5).setDepth(DEPTH.fx + 1).setScale(k * 0.2);
      this.scene.tweens.add({
        targets: sp,
        scale: k * (0.7 + count * 0.03),
        angle: this.rng.range(-40, 40),
        alpha: { from: 1, to: 0 },
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => sp.destroy(),
      });
      return;
    }
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.rng.float() * 0.5;
      const img = this.scene.add.image(x, y, s.texture, s.frames[0]).setDepth(DEPTH.fx + 1).setScale(0.4);
      const dist = this.rng.range(90, 170);
      this.scene.tweens.add({
        targets: img,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist * 0.7,
        angle: this.rng.range(-200, 200),
        scale: 0.9,
        alpha: 0,
        duration: 650,
        ease: 'Cubic.easeOut',
        onComplete: () => img.destroy(),
      });
    }
  }

  /** Vệt tốc độ khi Gargamel tăng tốc; `intensity` 0..1. */
  speedLines(intensity: number, t: number) {
    if (this.reduceMotion) return;
    const sp = this.speedDef;
    if (sp.real) {
      // sheet vệt tốc độ toàn khung: phủ một dải ngang, chạy vòng các khung
      if (!this.speedOverlay) {
        const k = (W * 0.75) / sp.frameW;
        this.speedOverlay = this.scene.add
          .sprite(W * 0.55, H * 0.6, sp.texture, sp.frames[0])
          .setDepth(DEPTH.fx - 1)
          .setScale(k, k * 0.9)
          .setAlpha(0);
      }
      this.speedOverlay.setAlpha(Math.max(0, intensity - 0.2) * 0.55);
      this.speedOverlay.setFrame(sp.frames[Math.floor(t * sp.fps) % sp.frames.length]);
      return;
    }
    if (intensity <= 0 || this.rng.float() > intensity * 0.5) return;
    const y = this.rng.range(140, H - 160);
    const img = this.scene.add
      .image(W + 150, y, sp.texture, sp.frames[0])
      .setDepth(DEPTH.fx)
      .setAlpha(0.5 + 0.4 * intensity)
      .setScale(this.rng.range(0.8, 1.6), 1);
    this.scene.tweens.add({
      targets: img,
      x: -300,
      duration: this.rng.range(260, 420),
      onComplete: () => img.destroy(),
    });
  }
}
