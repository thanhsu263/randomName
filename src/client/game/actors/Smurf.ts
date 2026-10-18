import Phaser from 'phaser';
import type { RosterEntry } from '@shared/types';
import type { AnimDef, AssetRegistry } from '../assets';
import { SMURF_BODY_ORIGIN, SMURF_HEAD_ORIGIN } from '../assets';
import { BASE_SPEED, DEPTH, FONT_DISPLAY, GARG_Y, HERD_MAX, LABEL_FONT_SIZE, LABEL_GAP, LABEL_LANE_STAGGER, LANES, LANE_SCALE, SMURF_SCALE, W } from '../config';
import type { Noise1D } from '@shared/rng';

/** Trạng thái: RUN → (TRIP → FALL → GETUP) → RUN → CAUGHT → IN_BAG → (POP → DUST → RUN). */
export type SmurfState = 'off' | 'run' | 'jump' | 'trip' | 'fall' | 'getup' | 'caught' | 'inbag' | 'pop' | 'dust';
export type HerdMode = 'herd' | 'enter' | 'exit';

export interface Look {
  tint: number;
  accessories: string[];
  /** biến thể nhân vật (sheet toàn thân trong art/) — rỗng khi dùng placeholder */
  variant: string;
}

export interface PathCtl {
  x1: number;
  t1: number;
  ease: (u: number) => number;
  x0?: number;
  t0?: number;
}

const JUMP_DUR = 0.55;
const JUMP_H = 110;
const FALL_DUR = 0.6;
const POP_DUR = 0.8;
const DUST_DUR = 0.65;
const CAUGHT_DUR = 0.3;

export const easeInOut = (u: number) => u * u * (3 - 2 * u);
export const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
export const easeIn = (u: number) => u * u;

let nextId = 1;

export class SmurfActor {
  readonly id = nextId++;
  readonly root: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly hat: Phaser.GameObjects.Image;
  private readonly accFront: Phaser.GameObjects.Image[] = [];
  private readonly accBack: Phaser.GameObjects.Image[] = [];
  private readonly label: Phaser.GameObjects.Container;
  private readonly banner: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly sweat: Phaser.GameObjects.Image;

  student: RosterEntry | null = null;
  state: SmurfState = 'off';
  mode: HerdMode = 'herd';
  x = 0;
  prevX = 0;
  vx = 0;
  lane = 1;
  yOff = 0;
  stateT = 0;
  phase = 0;
  baseRel = 0;
  noiseOff = 0;
  bias = 0;
  boost = 0;
  boostUntil = 0;
  path: PathCtl | null = null;
  sweating = false;
  /** đang được kịch bản dùng (mục tiêu / mồi nhử) — không cho vấp ngẫu nhiên */
  scripted = false;
  enterStopX = 1600;
  private variant = '';
  private flightFrom: [number, number] = [0, 0];
  private flightTo: [number, number] = [0, 0];
  private anim: AnimDef;
  private frameIdx = 0;
  private spin = 0;
  private extraScale = 1;
  onBagged: (() => void) | null = null;
  onLanded: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly assets: AssetRegistry,
  ) {
    this.anim = assets.anim('smurf_run');
    this.shadow = scene.add.image(0, 0, 'fx_shadow').setAlpha(0.8);
    this.body = scene.add.sprite(0, 0, this.anim.texture, this.anim.frames[0]).setOrigin(...this.anim.anchor);
    const hatAnchor = assets.imageAnchor.get('smurf_hat') ?? SMURF_HEAD_ORIGIN;
    this.hat = scene.add.image(0, 0, 'smurf_hat').setOrigin(hatAnchor[0], hatAnchor[1]);
    this.sweat = scene.add.image(0, 0, 'fx_sweat').setVisible(false);
    this.root = scene.add.container(0, 0, [this.shadow, this.body, this.hat, this.sweat]);
    for (let i = 0; i < 3; i++) {
      const s = scene.add.image(0, 0, 'fx_star').setScale(0.55).setVisible(false);
      this.stars.push(s);
      this.root.add(s);
    }
    this.banner = scene.add.image(0, 0, assets.banner(120));
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_DISPLAY,
        fontSize: `${LABEL_FONT_SIZE}px`,
        fontStyle: '800',
        color: '#ffffff',
        stroke: '#0a2559',
        strokeThickness: 8,
        padding: { left: 6, right: 6, top: 14, bottom: 6 },
      })
      .setOrigin(0.5, 0.56);
    this.label = scene.add.container(0, 0, [this.banner, this.text]).setDepth(DEPTH.labels);
    this.hide();
  }

  private hide() {
    this.root.setVisible(false);
    this.label.setVisible(false);
  }

  assign(student: RosterEntry, look: Look, x: number, lane: number, mode: HerdMode, rng: { float(): number }) {
    this.student = student;
    this.x = this.prevX = x;
    this.lane = lane;
    this.mode = mode;
    this.state = 'run';
    this.stateT = 0;
    this.phase = rng.float() * 8;
    this.baseRel = (rng.float() - 0.5) * 0.08;
    this.noiseOff = rng.float() * 200;
    this.bias = 0;
    this.boost = 0;
    this.vx = mode === 'enter' ? -0.33 * BASE_SPEED : 0;
    this.yOff = 0;
    this.spin = 0;
    this.extraScale = 1;
    this.path = null;
    this.sweating = false;
    this.scripted = false;
    this.onBagged = null;
    this.onLanded = null;
    this.variant = look.variant;
    const run = this.assets.anim('smurf_run');
    // art thật: đa dạng bằng biến thể, không tint (tint làm sai màu da)
    if (run.noTint) this.body.clearTint();
    else this.body.setTint(look.tint);
    // art thật đã vẽ sẵn mũ → ẩn mũ rời và phụ kiện overlay
    this.hat.setVisible(!run.bakedHat);
    for (const a of [...this.accFront, ...this.accBack]) a.destroy();
    this.accFront.length = 0;
    this.accBack.length = 0;
    for (const key of run.bakedHat ? [] : look.accessories) {
      const isHead = key === 'acc_glasses' || key === 'acc_pencil';
      const anchor = this.assets.imageAnchor.get(key) ?? (isHead ? SMURF_HEAD_ORIGIN : SMURF_BODY_ORIGIN);
      const img = this.scene.add.image(0, 0, key).setOrigin(anchor[0], anchor[1]);
      img.setData('head', isHead);
      if (key === 'acc_backpack') {
        this.accBack.push(img);
        this.root.addAt(img, 1);
      } else {
        this.accFront.push(img);
        this.root.addAt(img, this.root.getIndex(this.hat));
      }
    }
    // nhãn tên trên mũ
    this.text.setText(student.label);
    const tw = this.text.width;
    this.banner.setTexture(this.assets.banner(tw + 34));
    this.root.setVisible(true);
    this.label.setVisible(true);
    this.setAnim('smurf_run');
  }

  release() {
    this.student = null;
    this.state = 'off';
    this.path = null;
    this.scripted = false;
    this.hide();
  }

  get active() {
    return this.state !== 'off' && this.state !== 'inbag';
  }

  get controllable() {
    return this.state === 'run' || this.state === 'jump';
  }

  get laneY() {
    return LANES[this.lane];
  }

  get scale() {
    return SMURF_SCALE * LANE_SCALE[this.lane] * this.extraScale;
  }

  private setAnim(key: string) {
    const a = this.assets.anim(key);
    if (a !== this.anim) {
      this.anim = a;
      this.frameIdx = 0;
    }
  }

  setState(s: SmurfState) {
    this.state = s;
    this.stateT = 0;
    if (s === 'jump') this.setAnim('smurf_jump');
    else if (s === 'trip' || s === 'fall') this.setAnim('smurf_trip');
    else if (s === 'getup') this.setAnim('smurf_getup');
    else if (s === 'caught') this.setAnim('smurf_struggle');
    else if (s === 'pop' || s === 'dust') this.setAnim('smurf_escape_pop');
    else this.setAnim('smurf_run');
  }

  jump() {
    if (this.state === 'run') this.setState('jump');
  }

  trip() {
    if (this.state === 'run' || this.state === 'jump') {
      this.yOff = 0;
      this.setState('trip');
    }
  }

  /** Bị chộp: bay vào miệng túi. `bagPos` được cập nhật liên tục từ Gargamel. */
  caught(onBagged: () => void) {
    this.flightFrom = [this.x, this.laneY + this.yOff];
    this.path = null;
    this.sweating = false;
    this.onBagged = onBagged;
    this.label.setVisible(true);
    this.setState('caught');
  }

  /** Bật ra khỏi túi theo đường parabol. */
  popFrom(from: [number, number], landX: number, lane: number, onLanded: () => void) {
    this.flightFrom = from;
    this.lane = lane;
    this.flightTo = [landX, LANES[lane]];
    this.x = from[0];
    this.onLanded = onLanded;
    this.setState('pop');
  }

  setBoost(v: number, until: number) {
    this.boost = v;
    this.boostUntil = until;
  }

  /** Lực "bầy đàn" giữ đội hình tự nhiên. */
  private herdRel(t: number, noise: Noise1D, others: SmurfActor[], herdMin: number) {
    let rel = this.baseRel + 0.075 * noise.at(t * 0.33 + this.noiseOff) + this.bias;
    if (t < this.boostUntil) rel += this.boost;
    if (this.x < herdMin) rel += ((herdMin - this.x) / 350) * 0.3;
    if (this.x > HERD_MAX) rel -= ((this.x - HERD_MAX) / 250) * 0.3;
    rel += (1340 - this.x) / 9000;
    for (const o of others) {
      if (o === this || !o.active || o.lane !== this.lane) continue;
      const d = this.x - o.x;
      if (Math.abs(d) < 150) rel += (d >= 0 ? 1 : -1) * ((150 - Math.abs(d)) / 150) * 0.07;
    }
    return Math.max(-0.35, Math.min(0.45, rel));
  }

  update(t: number, dt: number, ws: number, noise: Noise1D, others: SmurfActor[], herdMin: number, bagPos: [number, number]) {
    if (this.state === 'off' || this.state === 'inbag') return;
    this.prevX = this.x;
    this.stateT += dt;
    const st = this.state;

    // --- chuyển động ngang ---
    if (st === 'caught') {
      const u = Math.min(1, this.stateT / CAUGHT_DUR);
      const e = easeIn(u);
      this.x = this.flightFrom[0] + (bagPos[0] - this.flightFrom[0]) * e;
      const y = this.flightFrom[1] + (bagPos[1] - this.flightFrom[1]) * e - Math.sin(u * Math.PI) * 60;
      this.yOff = y - this.laneY;
      this.extraScale = 1 - 0.7 * e;
      // art thật đã có tư thế giãy giụa → chỉ nghiêng nhẹ; placeholder thì xoay tròn
      this.spin = this.anim.real ? -u * 0.35 : -u * 2.5;
      if (u >= 1) {
        this.state = 'inbag';
        this.hide();
        this.extraScale = 1;
        this.spin = 0;
        this.onBagged?.();
      }
    } else if (st === 'pop') {
      const u = Math.min(1, this.stateT / POP_DUR);
      this.x = this.flightFrom[0] + (this.flightTo[0] - this.flightFrom[0]) * u;
      const y = this.flightFrom[1] + (this.flightTo[1] - this.flightFrom[1]) * u - 340 * 4 * u * (1 - u);
      this.yOff = y - this.laneY;
      this.extraScale = 0.4 + 0.6 * Math.min(1, u * 2.2);
      this.spin = u * Math.PI * 2;
      if (u >= 1) {
        this.yOff = 0;
        this.spin = 0;
        this.extraScale = 1;
        this.setState('dust');
        this.onLanded?.();
      }
    } else if (this.path && st !== 'dust') {
      const p = this.path;
      if (p.t0 === undefined || p.x0 === undefined) {
        p.t0 = t;
        p.x0 = this.x;
      }
      const span = Math.max(0.001, p.t1 - p.t0);
      const u = Math.max(0, Math.min(1, (t - p.t0) / span));
      this.x = p.x0 + (p.x1 - p.x0) * p.ease(u);
      this.vx = (this.x - this.prevX) / Math.max(dt, 1e-4);
    } else if (st === 'trip' || st === 'fall' || st === 'getup' || st === 'dust') {
      const k =
        st === 'trip'
          ? 0.2 + 0.4 * Math.min(1, this.stateT / 0.5)
          : st === 'fall'
            ? 0.6
            : st === 'getup'
              ? 0.5 - 0.3 * Math.min(1, this.stateT / 0.45)
              : 0.75;
      this.vx = -ws * k;
      this.x += this.vx * dt;
    } else if (this.mode === 'enter') {
      this.vx = -0.33 * BASE_SPEED;
      this.x += this.vx * dt;
      if (this.x <= this.enterStopX) this.mode = 'herd';
    } else if (this.mode === 'exit') {
      this.vx += (0.55 * BASE_SPEED - this.vx) * Math.min(1, dt * 3);
      this.x += this.vx * dt;
      if (this.x > W + 140) this.release();
    } else {
      const rel = this.herdRel(t, noise, others, herdMin);
      this.vx += (rel * BASE_SPEED - this.vx) * Math.min(1, dt * 2.5);
      this.x += this.vx * dt;
    }
    if ((this.state as SmurfState) === 'off') return;

    // --- trạng thái & khung hình ---
    const a = this.anim;
    const n = a.frames.length;
    switch (this.state) {
      case 'run': {
        const ground = (ws + this.vx) / BASE_SPEED;
        this.phase += dt * a.fps * Math.max(0.55, Math.min(1.7, ground));
        this.frameIdx = Math.floor(this.phase) % n;
        break;
      }
      case 'jump': {
        const u = this.stateT / JUMP_DUR;
        this.frameIdx = Math.min(n - 1, Math.floor(u * n));
        this.yOff = -JUMP_H * 4 * u * (1 - u);
        if (u >= 1) {
          this.yOff = 0;
          this.setState('run');
        }
        break;
      }
      case 'trip':
        this.frameIdx = Math.min(n - 1, Math.floor(this.stateT * a.fps));
        if (this.stateT >= n / a.fps) this.setState('fall');
        break;
      case 'fall':
        this.frameIdx = n - 1;
        if (this.stateT >= FALL_DUR) this.setState('getup');
        break;
      case 'getup':
        this.frameIdx = Math.min(n - 1, Math.floor(this.stateT * a.fps));
        if (this.stateT >= n / a.fps) {
          this.setState('run');
          if (!this.path) this.setBoost(0.32, t + 2.2);
        }
        break;
      case 'caught':
        this.frameIdx = Math.floor(this.stateT * a.fps) % n;
        break;
      case 'pop':
        // khung 0: bật lên, khung 1: lộn nhào trên không
        this.frameIdx = a.real ? (this.stateT < POP_DUR * 0.3 ? 0 : 1) : Math.floor(this.stateT * 8) % 2;
        break;
      case 'dust':
        // khung 2: chạm đất, 3: phủi bụi, 4: đứng dậy cười
        this.frameIdx = a.real
          ? this.stateT < 0.15 ? 2 : this.stateT < 0.45 ? 3 : 4
          : this.stateT < 0.12 ? 2 : 3 + (Math.floor(this.stateT * 9) % 2);
        if (this.stateT >= DUST_DUR) {
          this.setState('run');
          this.setBoost(0.38, t + 2.0);
        }
        break;
    }
    this.render(t);
  }

  render(t: number) {
    const a = this.anim;
    const fi = Math.min(this.frameIdx, a.frames.length - 1);
    const s = this.scale;
    const fs = a.frameSize;
    const k = (s * 256) / fs; // px hiển thị trên mỗi px khung
    const [ax, ay] = a.anchor;
    this.root.setPosition(this.x, this.laneY + this.yOff);
    // khi bay vào / bật ra khỏi túi: vẽ trên phù thủy để không bị che
    const flying = this.state === 'caught' || this.state === 'pop';
    this.root.setDepth(DEPTH.actors + (flying ? GARG_Y + 5 : this.laneY));
    // art thật đã vẽ sẵn tư thế lộn nhào → chỉ xoay khi dùng placeholder
    this.root.setRotation(a.real && this.state === 'pop' ? 0 : this.spin);
    this.body.setTexture(a.variants[this.variant] ?? a.texture, a.frames[fi]);
    this.body.setOrigin(ax, ay);
    this.body.setScale(k);
    const ground = this.state === 'caught' || this.state === 'pop';
    this.shadow.setVisible(!ground);
    this.shadow.setPosition(0, -this.yOff + 2);
    this.shadow.setScale(s * 0.75 * (1 + this.yOff / 400), s * 0.8);

    const head = a.head?.[fi] ?? [130 * (fs / 256), 110 * (fs / 256), 0];
    const body = a.body?.[fi] ?? [122 * (fs / 256), 186 * (fs / 256), 0];
    const hx = (head[0] - ax * a.frameW) * k;
    const hy = (head[1] - ay * a.frameH) * k;
    const bob = this.state === 'run' && !a.real ? Math.sin(this.phase * Math.PI * 0.25) * 2 : 0;
    this.hat.setPosition(hx, hy + bob).setRotation(head[2] + bob * 0.02).setScale(s);
    const bx = (body[0] - ax * a.frameW) * k;
    const by = (body[1] - ay * a.frameH) * k;
    for (const img of [...this.accFront, ...this.accBack]) {
      if (img.getData('head')) img.setPosition(hx, hy + bob).setRotation(head[2]);
      else img.setPosition(bx, by).setRotation(body[2]);
      img.setScale(s);
    }
    // mồ hôi & sao chóng mặt vẽ bằng code: chỉ dùng với placeholder (art thật đã có sao trong khung vấp)
    const procFx = !a.real;
    this.sweat.setVisible(procFx && this.sweating);
    if (procFx && this.sweating) {
      this.sweat.setPosition(hx - 40 * s, hy - 30 * s + ((t * 60) % 14)).setScale(s);
    }
    const dizzy = procFx && (this.state === 'fall' || (this.state === 'getup' && this.stateT < 0.3));
    this.stars.forEach((st, i) => {
      st.setVisible(dizzy);
      if (dizzy) {
        const ang = t * 7 + (i * Math.PI * 2) / 3;
        st.setPosition(hx + Math.cos(ang) * 42 * s, hy - 26 * s + Math.sin(ang) * 12 * s);
      }
    });

    // nhãn tên: neo theo headTrack (tâm miếng vải trên mũ), luôn nằm trên cùng để đọc rõ
    const labelScale = ground ? Math.max(0.5, this.extraScale) : 1;
    const stagger = (LANES.length - 1 - this.lane) * LABEL_LANE_STAGGER;
    const top = a.top?.[fi];
    let ox: number;
    let oy: number;
    if (top) {
      // art thật: đáy băng rôn nằm ngay trên đỉnh mũ của nhân vật (không đè lên mũ/mặt)
      ox = (top[0] - ax * a.frameW) * k;
      oy = (top[1] - ay * a.frameH) * k - LABEL_GAP * s - (this.banner.height / 2) * labelScale + bob - stagger;
    } else {
      ox = hx + a.labelOffset[0] * k;
      oy = hy + a.labelOffset[1] * k + bob - stagger;
    }
    const spin = a.real && this.state === 'pop' ? 0 : this.spin;
    const lx = this.x + Math.cos(spin) * ox - Math.sin(spin) * oy;
    const ly = this.laneY + this.yOff + Math.sin(spin) * ox + Math.cos(spin) * oy;
    const rot = Math.max(-0.12, Math.min(0.12, (head[2] - (a.real ? 0.21 : 0.13)) * 0.25));
    this.label
      .setPosition(lx, ly)
      .setRotation(rot)
      .setScale(labelScale)
      .setAlpha(this.state === 'caught' ? 1 - Math.min(1, this.stateT / CAUGHT_DUR) * 0.6 : 1);
  }
}
