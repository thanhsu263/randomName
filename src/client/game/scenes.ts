import Phaser from 'phaser';
import { ChaChaRng, Noise1D } from '@shared/rng';
import type { DrawRecord } from '@shared/types';
import { AssetRegistry, queueRealAssets, type Manifest } from './assets';
import { GargamelActor } from './actors/Gargamel';
import { Director, type GameEvent } from './Director';
import { Parallax } from './world/Parallax';
import { Obstacles } from './world/Obstacles';
import { Fx } from './fx';
import { DEPTH, FONT_DISPLAY, H, STEP, W } from './config';

export interface ChaseData {
  draw: DrawRecord;
  reduceMotion: boolean;
  maxVisible: number;
  /** ẩn thanh thời gian trên HUD */
  hideTimer?: boolean;
  replay: boolean;
  onEvent: (e: GameEvent) => void;
  onFinish: (skipped: boolean) => void;
}

// ====================================================================== Boot

export class BootScene extends Phaser.Scene {
  private manifest!: Manifest;
  constructor() {
    super('boot');
  }
  init(data: { manifest: Manifest; onReady: (r: AssetRegistry) => void }) {
    this.manifest = data.manifest;
    this.registry.set('onReady', data.onReady);
  }
  preload() {
    queueRealAssets(this, this.manifest);
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn(`[asset] Không nạp được ${f.key}, dùng placeholder`));
  }
  create() {
    const reg = new AssetRegistry(this, this.manifest);
    reg.build();
    this.game.registry.set('assets', reg);
    (this.registry.get('onReady') as (r: AssetRegistry) => void)(reg);
  }
}

// ====================================================================== Rượt đuổi

export class ChaseScene extends Phaser.Scene {
  private cfg!: ChaseData;
  private director!: Director;
  private parallax!: Parallax;
  private obstacles!: Obstacles;
  private garg!: GargamelActor;
  private t = 0;
  private acc = 0;
  private debt = 0;
  private duration = 0;
  private ended = false;
  private endReal = 0;
  private finished = false;
  private tick = 0;

  constructor() {
    super('chase');
  }

  create(data: ChaseData) {
    this.cfg = data;
    this.t = 0;
    this.acc = 0;
    this.debt = 0;
    this.ended = false;
    this.finished = false;
    this.tick = 0;
    this.duration = data.draw.script.durationMs / 1000;
    const assets = this.game.registry.get('assets') as AssetRegistry;
    const seed = data.draw.script.seed;
    const rng = new ChaChaRng(seed, 1);
    const noise = new Noise1D(new ChaChaRng(seed, 2));
    this.cameras.main.setBackgroundColor('#8fd3ff');
    this.cameras.main.setZoom(1).centerOn(W / 2, H / 2);
    this.tweens.timeScale = 1;

    this.parallax = new Parallax(this, assets, rng, data.reduceMotion);
    this.obstacles = new Obstacles(this, rng, assets);
    this.garg = new GargamelActor(this, assets);
    const fx = new Fx(this, rng, data.reduceMotion, assets);
    this.director = new Director(
      this,
      assets,
      data.draw.script,
      data.draw.roster,
      this.garg,
      this.obstacles,
      fx,
      rng,
      noise,
      { maxVisible: data.maxVisible, reduceMotion: data.reduceMotion },
      (e) => this.emitEvent(e),
    );
    this.scene.launch('hud', {
      n: data.draw.script.n,
      replay: data.replay,
      drawId: data.draw.id,
      className: data.draw.className,
      hideTimer: data.hideTimer ?? false,
      reduceMotion: data.reduceMotion,
      chase: this,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop('hud'));
  }

  private emitEvent(e: GameEvent) {
    this.events.emit('game', e);
    this.cfg.onEvent(e);
  }

  private inSlowmo(t: number) {
    return this.director.slowmo.some(([a, b]) => t >= a && t <= b);
  }

  override update(_time: number, delta: number) {
    if (this.finished) return;
    this.acc += Math.min(delta, 100) / 1000;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step();
    }
    if (this.ended && performance.now() - this.endReal > 1600) this.finish(false);
  }

  private step() {
    let scale = 1;
    if (!this.cfg.reduceMotion) {
      if (this.inSlowmo(this.t)) {
        scale = 0.32;
        this.debt += (1 - scale) * STEP;
      } else if (this.debt > 0) {
        // bù lại thời gian slow-motion để tổng thời lượng vẫn đúng kịch bản
        scale = 1.15;
        this.debt = Math.max(0, this.debt - 0.15 * STEP);
      }
    }
    const dt = STEP * scale;
    this.t += dt;
    this.tweens.timeScale = scale < 1 ? scale : 1;
    const t = this.t;
    const ws = this.director.worldSpeed(t);
    this.parallax.update(ws * dt);
    this.obstacles.update(t, dt, ws);
    this.director.update(t, dt, ws);

    // camera: zoom nhẹ khi sắp chộp
    const cam = this.cameras.main;
    const c = this.cfg.reduceMotion ? 0 : this.director.charge(t);
    const z = 1 + 0.07 * c;
    cam.setZoom(z);
    const hw = W / 2 / z;
    const hh = H / 2 / z;
    cam.centerOn(Phaser.Math.Clamp(W / 2 - 80 * c, hw, W - hw), Phaser.Math.Clamp(H / 2 + 90 * c, hh, H - hh));

    if (++this.tick % 6 === 0) {
      this.emitEvent({ type: 'progress', t: Math.min(t, this.duration), duration: this.duration, intensity: c });
    }
    if (!this.ended && t >= this.duration) {
      this.ended = true;
      this.endReal = performance.now();
      this.emitEvent({ type: 'end' });
    }
  }

  finish(skipped: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.cfg.onFinish(skipped);
  }
}

// ====================================================================== HUD

interface HudData {
  n: number;
  replay: boolean;
  drawId: number;
  className: string;
  hideTimer: boolean;
  reduceMotion: boolean;
  chase: ChaseScene;
}

const textStyle = (size: number, color = '#ffffff', stroke = '#1b1a2b', thick = 10): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT_DISPLAY,
  fontSize: `${size}px`,
  fontStyle: '800',
  color,
  stroke,
  strokeThickness: thick,
  padding: { left: 12, right: 12, top: Math.round(size * 0.35), bottom: 8 },
});

export class HudScene extends Phaser.Scene {
  private hud!: HudData;
  private bar: Phaser.GameObjects.Graphics | null = null;
  private timeText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private bagIcon!: Phaser.GameObjects.Image;
  private inBag = 0;
  private progress = 0;
  private bagKick = 0;
  private bagIconScale = 0.4;
  private realScroll = false;
  private fill: Phaser.GameObjects.NineSlice | null = null;
  private marker: Phaser.GameObjects.Image | null = null;
  private trackX = 0;
  private trackW = 0;
  private fillSc = 1;
  private fillCap = 10;

  constructor() {
    super('hud');
  }

  create(data: HudData) {
    this.hud = data;
    this.inBag = 0;
    this.progress = 0;
    const timerStart = this.children.list.length; // các đối tượng tạo từ đây tới timeText thuộc thanh thời gian
    const assets = this.game.registry.get('assets') as AssetRegistry;
    this.realScroll = assets.hasReal('ui_scroll') && assets.hasReal('ui_scroll_fill');
    if (this.realScroll) this.buildRealScroll(assets);
    else {
      // cuộn giấy da thủ tục + thanh vẽ bằng Graphics
      this.add.image(W / 2, 74, 'ui_scroll').setScale(0.92, 0.86);
      this.bar = this.add.graphics();
      this.add.image(W / 2 - 425, 96, 'obs_mushroom').setOrigin(0.5, 1).setScale(0.36);
    }
    this.timeText = this.add
      .text(this.realScroll ? W / 2 : W / 2 + 330, this.realScroll ? 158 : 74, '', textStyle(34, '#5a3410', '#fbedc8', 7))
      .setOrigin(0.5);
    if (data.hideTimer) {
      for (const o of this.children.list.slice(timerStart)) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      // tháo tham chiếu để update() bỏ qua phần vẽ thanh tiến trình
      this.fill = null;
      this.marker = null;
      this.bar = null;
    }
    // bảng gỗ đếm số đã bắt
    const btn = assets.image('ui_button');
    let cx: number;
    let cy = 84;
    if (assets.hasReal('ui_button') && btn?.bbox) {
      const [bx, by, bw, bh] = btn.bbox;
      const tex = this.textures.get('ui_button');
      if (!tex.has('crop')) tex.add('crop', 0, bx, by, bw, bh);
      const sc = 380 / bw;
      cx = W - 30 - (bw * sc) / 2;
      cy = 26 + (bh * sc) / 2;
      this.add.image(cx, cy, 'ui_button', 'crop').setScale(sc);
      // tâm vùng chữ của bảng (label) so với khung cắt
      if (btn.label) {
        cx += (btn.label[0] + btn.label[2] / 2 - (bx + bw / 2)) * sc;
        cy += (btn.label[1] + btn.label[3] / 2 - (by + bh / 2)) * sc - 6;
      }
    } else {
      this.add.image(W - 250, 84, 'ui_sign').setScale(0.82);
      cx = W - 220;
    }
    const bag = assets.anim('bag_idle');
    this.bagIconScale = 110 / bag.frameSize;
    // túi nằm trong bảng, bên trái chữ
    this.bagIconScale = 92 / bag.frameSize;
    this.bagIcon = this.add.image(cx - 140, cy + 4, bag.texture, bag.frames[0]).setScale(this.bagIconScale);
    this.countText = this.add.text(cx + 34, cy, '', textStyle(44, '#fff4c2', '#4a2a0a', 9)).setOrigin(0.5);
    this.updateCount();
    if (data.replay) {
      this.add
        .text(40, 40, `▶ PHÁT LẠI lượt #${data.drawId}`, textStyle(32, '#ffe066', '#1b1a2b', 8))
        .setOrigin(0, 0.5);
    }
    data.chase.events.on('game', this.onGame, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => data.chase.events.off('game', this.onGame, this));
  }

  /** Thanh thời gian từ 3 mảnh art: cuộn giấy (nine-slice 3 đoạn), thân thanh đầy, nấm đánh dấu. */
  private buildRealScroll(assets: AssetRegistry) {
    const scroll = assets.image('ui_scroll')!;
    const fill = assets.image('ui_scroll_fill')!;
    const [sx, sy, sw, sh] = scroll.bbox ?? [0, 0, scroll.width ?? 512, scroll.height ?? 512];
    const [tx, ty, tw, th] = scroll.track ?? [sx + sw * 0.15, sy + sh / 2 - 18, sw * 0.7, 36];
    const crop = (key: string, bb: number[]) => {
      const t = this.textures.get(key);
      if (!t.has('crop')) t.add('crop', 0, bb[0], bb[1], bb[2], bb[3]);
    };
    crop('ui_scroll', [sx, sy, sw, sh]);
    const sc = 0.62;
    const displayW = 940;
    const width = displayW / sc;
    const left = tx - sx + 4;
    const right = sx + sw - (tx + tw) + 4;
    const cy = 22 + (sh * sc) / 2;
    this.add.nineslice(W / 2, cy, 'ui_scroll', 'crop', width, sh, left, right, 0, 0).setScale(sc);
    // toạ độ màn hình của rãnh thanh tiến trình
    this.trackX = W / 2 - displayW / 2 + (tx - sx) * sc;
    this.trackW = (width - (tx - sx) - (sx + sw - (tx + tw))) * sc;
    const trackCy = cy + (ty + th / 2 - (sy + sh / 2)) * sc;
    const [fx, fy, fw, fh] = fill.bbox ?? [tx, ty, tw, th];
    crop('ui_scroll_fill', [fx, fy, fw, fh]);
    this.fillSc = (th * sc) / fh;
    this.fillCap = Math.min(fw / 2 - 1, fh * 0.6);
    this.fill = this.add
      .nineslice(this.trackX, trackCy, 'ui_scroll_fill', 'crop', fh, fh, this.fillCap, this.fillCap, 0, 0)
      .setOrigin(0, 0.5)
      .setScale(this.fillSc)
      .setVisible(false);
    if (assets.hasReal('ui_scroll_marker')) {
      const mk = assets.image('ui_scroll_marker')!;
      const mb = mk.bbox ?? [0, 0, mk.width ?? 512, mk.height ?? 512];
      crop('ui_scroll_marker', mb);
      this.marker = this.add
        .image(this.trackX, trackCy, 'ui_scroll_marker', 'crop')
        .setOrigin(0.5, 0.75)
        .setScale((th * sc * 1.9) / mb[3]);
    }
  }

  private updateCount() {
    this.countText.setText(`Đã bắt: ${this.inBag}/${this.hud.n}`);
  }

  private onGame(e: GameEvent) {
    switch (e.type) {
      case 'start':
        this.pop('GARGAMEL XUẤT KÍCH!', '#ffd23f', 96, 1300);
        break;
      case 'progress':
        this.progress = e.t / e.duration;
        this.timeText.setText(`còn ${Math.max(0, Math.ceil(e.duration - e.t))} giây`);
        break;
      case 'catch':
        this.inBag = e.inBag;
        this.bagKick = 1;
        this.updateCount();
        this.pop(`BẮT ĐƯỢC ${e.student.label}!`, '#ffffff', 112, 1250, '#1d5fc4');
        break;
      case 'escape':
        this.inBag = e.inBag;
        this.bagKick = 1;
        this.updateCount();
        this.pop('THOÁT RỒI!', '#7dff7a', 120, 1100, '#14501c');
        break;
      case 'whiff':
        this.pop('HỤT!', '#ffffff', 84, 700, '#7a1f1f', 330);
        break;
      case 'miss':
        this.pop('HỤT RỒI!', '#ffffff', 96, 900, '#7a1f1f', 330);
        break;
      case 'stumble':
        this.pop('Ối!', '#ffffff', 92, 800, '#7a1f1f', 330);
        break;
      case 'end':
        this.pop('HẾT GIỜ!', '#ffd23f', 120, 1500);
        break;
    }
  }

  private pop(text: string, color: string, size: number, hold: number, stroke = '#1b1a2b', y = 400) {
    const t = this.add
      .text(W / 2, y, text, textStyle(size, color, stroke, 14))
      .setOrigin(0.5)
      .setDepth(DEPTH.pop)
      .setShadow(0, 8, 'rgba(0,0,0,.35)', 0, true, true);
    if (this.hud.reduceMotion) {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 150, yoyo: true, hold, onComplete: () => t.destroy() });
      return;
    }
    t.setScale(0.2);
    this.tweens.chain({
      targets: t,
      tweens: [
        { scale: 1, duration: 280, ease: 'Back.easeOut' },
        { scale: 1.04, duration: hold, ease: 'Sine.easeInOut' },
        { alpha: 0, y: y - 60, duration: 260, ease: 'Quad.easeIn' },
      ],
      onComplete: () => t.destroy(),
    });
  }

  override update(time: number, delta: number) {
    const p = Phaser.Math.Clamp(this.progress, 0, 1);
    if (this.realScroll && this.fill) {
      const w = this.trackW * p;
      const minW = (this.fillCap * 2 + 2) * this.fillSc;
      this.fill.setVisible(w >= minW);
      if (w >= minW) this.fill.setSize(w / this.fillSc, this.fill.height);
      this.marker?.setX(this.trackX + Math.max(0, w));
    } else if (this.bar) {
      const x0 = W / 2 - 380;
      const w = 640;
      const g = this.bar;
      g.clear();
      g.fillStyle(0x8b5a2b, 0.35).fillRoundedRect(x0, 60, w, 28, 12);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x4caf3f),
        Phaser.Display.Color.ValueToColor(0xe2262c),
        100,
        Math.round(p * 100),
      );
      if (p > 0) g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1).fillRoundedRect(x0, 60, Math.max(24, w * p), 28, 12);
      g.lineStyle(4, 0x1b1a2b, 1).strokeRoundedRect(x0, 60, w, 28, 12);
    }
    // biểu tượng túi rung khi có người bên trong
    this.bagKick = Math.max(0, this.bagKick - delta / 500);
    const shake = this.hud.reduceMotion ? 0 : (this.inBag > 0 ? 0.08 + 0.03 * Math.min(this.inBag, 5) : 0) * Math.sin(time / 45);
    this.bagIcon.setRotation(shake + this.bagKick * 0.3 * Math.sin(time / 30));
    this.bagIcon.setScale(this.bagIconScale * (1 + this.bagKick * 0.25));
  }
}
