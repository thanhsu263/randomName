import Phaser from 'phaser';
import type { Noise1D } from '@shared/rng';
import type { AnimDef, AssetRegistry } from '../assets';
import { DEPTH, GARG_BASE_X, GARG_SCALE, GARG_Y } from '../config';
import type { PathCtl } from './Smurf';

export type GargMode = 'run' | 'lunge' | 'fall' | 'angry' | 'stagger';

const LUNGE_WINDUP = 0.42; // thời gian từ lúc vung tay tới lúc túi chụp xuống
const LUNGE_AFTER = 0.3;
/** thời gian giữ khung miệng túi mở để mục tiêu bay vào (khớp CAUGHT_DUR của Smurf) */
const CATCH_HOLD = 0.3;
const FALL_ANIM = 0.6;
const FALL_HOLD = 0.75;

export class GargamelActor {
  readonly body: Phaser.GameObjects.Sprite;
  readonly bag: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  x = -260;
  yOff = 0;
  mode: GargMode = 'run';
  modeT = 0;
  phase = 0;
  path: PathCtl | null = null;
  hopT = -1;
  wobble = 0;
  bagCount = 0;
  /** 0 = yên, 1 = giãy dữ dội (sắp thoát) */
  bagStruggle = 0;
  bagOpenT = -1;
  bagSquash = 0;
  speedMul = 1;
  private anim: AnimDef;
  private frameIdx = 0;
  private lungeSlamT = 0;
  private lungeMiss = false;
  private mouth: [number, number] = [0, 0];
  private modeUntil = 0;
  private fallSlide = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly assets: AssetRegistry,
  ) {
    this.anim = assets.anim('gargamel_run');
    this.shadow = scene.add.image(0, GARG_Y + 4, 'fx_shadow').setScale(2.6, 1.6).setDepth(DEPTH.actors + GARG_Y - 1);
    this.body = scene.add.sprite(this.x, GARG_Y, this.anim.texture, 0).setOrigin(...this.anim.anchor);
    this.body.setDepth(DEPTH.actors + GARG_Y);
    const bagDef = assets.anim('bag_idle');
    this.bag = scene.add.sprite(0, 0, bagDef.texture, bagDef.frames[0]);
    this.bag.setOrigin(assets.bagGrip[0], assets.bagGrip[1]).setDepth(DEPTH.actors + GARG_Y + 1);
  }

  private setAnim(key: string) {
    this.anim = this.assets.anim(key);
    this.frameIdx = 0;
  }

  private setMode(m: GargMode, t: number, until = 0) {
    this.mode = m;
    this.modeT = 0;
    this.modeUntil = until;
    if (m === 'lunge') this.setAnim('gargamel_lunge');
    else if (m === 'fall') this.setAnim('gargamel_miss_fall');
    else if (m === 'angry') this.setAnim('gargamel_angry');
    else this.setAnim('gargamel_run');
    void t;
  }

  /**
   * Khung "miệng túi chạm mục tiêu" trong hoạt cảnh vồ. Art thật: manifest ghi `catchFrame`
   * (khung có miệng túi hướng ngang nhất trước khung túi đầy); thiếu thì lùi 1 khung so với slamFrame;
   * placeholder: chính slamFrame.
   */
  private get catchFrame(): number {
    const a = this.assets.anim('gargamel_lunge');
    if (a.catchFrame !== undefined) return a.catchFrame;
    const slam = a.slamFrame ?? 3;
    return a.real && a.sackFull.length ? Math.max(0, slam - 1) : slam;
  }

  /** Độ vươn ngang từ chân tới miệng túi ở khung chụp (để canh vị trí bắt). */
  get reach(): number {
    const a = this.assets.anim('gargamel_lunge');
    const hand = a.hand?.[this.catchFrame];
    const k = (GARG_SCALE * 512) / a.frameSize;
    return hand ? (hand[0] - a.anchor[0] * a.frameW) * k : 200;
  }

  moveTo(x1: number, t1: number, ease: (u: number) => number) {
    this.path = { x1, t1, ease };
  }

  /** Vồ: miệng túi chạm mục tiêu đúng lúc slamT. miss = vồ hụt (không hiện khung túi đầy). */
  lunge(slamT: number, t: number, miss = false) {
    this.lungeSlamT = slamT;
    this.lungeMiss = miss;
    this.setMode('lunge', t);
  }

  fall(t: number) {
    this.path = null;
    this.fallSlide = 0;
    this.setMode('fall', t);
  }

  angry(t: number, dur: number) {
    this.setMode('angry', t, t + dur);
  }

  stagger(t: number, dur: number) {
    this.setMode('stagger', t, t + dur);
  }

  hop() {
    if (this.hopT < 0 && this.mode === 'run') this.hopT = 0;
  }

  openBag() {
    this.bagOpenT = 0;
  }

  /** Vị trí miệng túi trên màn hình. */
  bagMouth(): [number, number] {
    if (this.anim.bagInHand) return [this.mouth[0], this.mouth[1]];
    return [this.bag.x, this.bag.y + 26 * this.bag.scaleY];
  }

  update(t: number, dt: number, ws: number, noise: Noise1D) {
    this.modeT += dt;
    const prevX = this.x;

    // --- vị trí ---
    if (this.mode === 'fall') {
      const k = this.modeT < FALL_ANIM ? 0.3 + 0.5 * (this.modeT / FALL_ANIM) : 0.85;
      this.fallSlide += ws * k * dt;
      this.x -= ws * k * dt * 0.6;
    } else if (this.path) {
      const p = this.path;
      if (p.t0 === undefined || p.x0 === undefined) {
        p.t0 = t;
        p.x0 = this.x;
      }
      const u = Math.max(0, Math.min(1, (t - p.t0) / Math.max(0.001, p.t1 - p.t0)));
      this.x = p.x0 + (p.x1 - p.x0) * p.ease(u);
      if (u >= 1 && this.mode !== 'lunge') this.path = null;
    } else if (this.mode !== 'angry') {
      const target = GARG_BASE_X + 34 * noise.at(t * 0.25 + 50);
      this.x += (target - this.x) * Math.min(1, dt * 1.1);
    }
    const vx = (this.x - prevX) / Math.max(dt, 1e-4);

    // --- nhảy nhẹ qua chướng ngại ---
    if (this.hopT >= 0) {
      this.hopT += dt;
      const u = this.hopT / 0.45;
      this.yOff = -46 * 4 * u * (1 - u);
      if (u >= 1) {
        this.hopT = -1;
        this.yOff = 0;
      }
    }

    // --- khung hình ---
    const a = this.anim;
    const n = a.frames.length;
    switch (this.mode) {
      case 'run':
      case 'stagger': {
        const g = (ws + vx) / 520;
        this.phase += dt * a.fps * Math.max(0.6, Math.min(1.8, g)) * this.speedMul;
        this.frameIdx = Math.floor(this.phase) % n;
        this.wobble = this.mode === 'stagger' ? Math.sin(this.modeT * 26) * 0.09 : 0;
        if (this.mode === 'stagger' && t >= this.modeUntil) this.setMode('run', t);
        break;
      }
      case 'lunge': {
        const start = this.lungeSlamT - LUNGE_WINDUP;
        const cf = this.catchFrame;
        const after = this.lungeSlamT + CATCH_HOLD;
        if (t < this.lungeSlamT) this.frameIdx = Math.max(0, Math.min(cf, Math.floor(((t - start) / LUNGE_WINDUP) * (cf + 0.999))));
        else if (t < after || this.lungeMiss) this.frameIdx = cf; // giữ miệng túi mở trong lúc mục tiêu bay vào
        else this.frameIdx = Math.min(n - 1, cf + 1 + Math.floor(((t - after) / LUNGE_AFTER) * (n - 1 - cf)));
        if (t >= after + LUNGE_AFTER) {
          this.path = null;
          this.setMode('run', t);
        }
        break;
      }
      case 'fall':
        this.frameIdx = this.modeT < FALL_ANIM ? Math.min(n - 2, Math.floor((this.modeT / FALL_ANIM) * (n - 1))) : n - 1;
        if (this.modeT >= FALL_ANIM + FALL_HOLD) this.setMode('run', t);
        break;
      case 'angry':
        this.frameIdx = Math.floor(this.modeT * a.fps) % n;
        if (t >= this.modeUntil) this.setMode('run', t);
        break;
    }
    this.render(t, dt);
  }

  private render(t: number, dt: number) {
    const a = this.anim;
    const fi = Math.min(this.frameIdx, a.frames.length - 1);
    const k = (GARG_SCALE * 512) / a.frameSize;
    const [ax, ay] = a.anchor;
    this.body.setTexture(a.texture, a.frames[fi]);
    this.body.setOrigin(ax, ay);
    this.body.setScale(k);
    this.body.setPosition(this.x, GARG_Y + this.yOff);
    this.body.setRotation(this.wobble);
    this.shadow.setPosition(this.x + 10, GARG_Y + 4).setScale(2.6 * (1 + this.yOff / 300), 1.6);

    // vị trí tay / miệng túi theo track của khung hiện tại (xoay theo wobble)
    const hand = a.hand?.[fi] ?? [a.frameW * 0.72, a.frameH * 0.6, 0];
    const dx = (hand[0] - ax * a.frameW) * k;
    const dy = (hand[1] - ay * a.frameH) * k;
    const cos = Math.cos(this.wobble);
    const sin = Math.sin(this.wobble);
    const hx = this.x + dx * cos - dy * sin;
    const hy = GARG_Y + this.yOff + dx * sin + dy * cos;
    this.mouth = [hx, hy];

    if (a.bagInHand) {
      this.renderBagInHand(t, a, fi, hx, hy, hand[2] + this.wobble, k);
      return;
    }
    this.bag.setVisible(true);
    this.bag.setPosition(hx, hy);

    let bagKey = this.bagCount > 0 ? 'bag_wriggle' : 'bag_idle';
    let bagFrame = 0;
    if (this.bagOpenT >= 0) {
      this.bagOpenT += dt;
      bagKey = 'bag_open';
      const n = this.assets.anim('bag_open').frames.length;
      const u = this.bagOpenT / 0.42;
      bagFrame = u < 0.5 ? Math.floor(u * 2 * n) : Math.max(0, Math.floor((1 - u) * 2 * n));
      if (u >= 1) this.bagOpenT = -1;
    } else if (this.bagCount > 0) {
      const fps = 5 + this.bagStruggle * 12;
      bagFrame = Math.floor(t * fps);
    }
    const bagDef = this.assets.anim(bagKey);
    bagFrame = Math.min(bagDef.frames.length - 1, Math.abs(bagFrame) % bagDef.frames.length);
    this.bag.setTexture(bagDef.texture, bagDef.frames[bagFrame]);
    this.bag.setOrigin(this.assets.bagGrip[0], this.assets.bagGrip[1]);
    const base = (0.78 * GARG_SCALE * 256) / bagDef.frameSize;
    const grow = 1 + Math.min(this.bagCount, 6) * 0.045;
    const sq = this.bagSquash + this.bagStruggle * 0.14 * Math.sin(t * 31);
    this.bag.setScale(base * grow * (1 + sq), base * grow * (1 - sq));
    const swing = this.mode === 'run' ? Math.sin(this.phase * (Math.PI / 4)) * 0.12 : 0;
    this.bag.setRotation(swing + this.wobble * 2 + this.bagStruggle * 0.18 * Math.sin(t * 23));
  }

  /**
   * Art thật: phù thủy đã cầm sẵn túi mở trong tay → không vẽ túi rời. Khi trong túi có người,
   * đè sprite túi buộc kín (bag_wriggle) lên đúng miệng túi vẽ sẵn, xoay theo hướng miệng túi.
   */
  private renderBagInHand(t: number, a: AnimDef, fi: number, mx: number, my: number, facing: number, k: number) {
    this.bagOpenT = -1;
    const lunging = this.mode === 'lunge';
    const artFull = a.sackFull.includes(fi);
    const show = this.bagCount > 0 && !lunging && !artFull;
    this.bag.setVisible(show);
    if (!show) return;
    const def = this.assets.anim('bag_wriggle');
    const fps = 5 + this.bagStruggle * 12;
    const f = Math.floor(t * fps) % def.frames.length;
    this.bag.setTexture(def.texture, def.frames[f]);
    this.bag.setOrigin(this.assets.bagGrip[0], this.assets.bagGrip[1]);
    // khít lên túi vẽ sẵn: rộng/dài của túi = bội số bán kính miệng (manifest.sackOverlay),
    // chia cho kích thước thân túi trong sprite (manifest.bagSize); cổ túi trùng tâm miệng túi
    const r = a.sackRadius ?? 34;
    const [ow, ol] = a.sackOverlay ?? [2.5, 3.1];
    const [bw, bl] = this.assets.bagSize;
    const sx = (k * r * ow) / bw;
    const sy = (k * r * ol) / bl;
    const grow = 1 + Math.min(this.bagCount, 6) * 0.03;
    const sq = this.bagSquash + this.bagStruggle * 0.12 * Math.sin(t * 31);
    this.bag.setScale(sx * grow * (1 + sq), sy * grow * (1 - sq));
    // trục "xuống" của túi (+y) hướng ra xa miệng túi, tức ngược hướng `facing`
    // nhích túi đè về phía nắm tay (theo hướng miệng) để che nốt phần cổ túi cũ ló ra cạnh tay
    // và nhích sang bên (vuông góc với trục túi) về phía cổ túi cũ hay ló ra
    const up = r * k * 0.3;
    const side = r * k * 0.25;
    this.bag.setPosition(mx + Math.cos(facing) * up - Math.sin(facing) * side, my + Math.sin(facing) * up + Math.cos(facing) * side);
    this.bag.setRotation(facing + Math.PI / 2 + this.bagStruggle * 0.15 * Math.sin(t * 23));
  }
}
