/**
 * "Đạo diễn" màn rượt đuổi: biến event script (CATCH / ESCAPE / MISS) thành các "cue" có thời gian,
 * điều khiển đàn xì trum, Gargamel, chướng ngại vật, nhịp độ hồi hộp (tension curve).
 *
 * Mọi quyết định hình ảnh dùng RNG luồng 1 suy ra từ seed, chạy theo bước cố định ⇒ phát lại giống hệt.
 * Kết quả (ai bị bắt, khi nào) chỉ phụ thuộc kịch bản đã sinh sẵn.
 */
import Phaser from 'phaser';
import type { ChaChaRng, Noise1D } from '@shared/rng';
import type { DrawScript, RosterEntry, ScriptEvent } from '@shared/types';
import type { AssetRegistry } from './assets';
import { SmurfActor, easeIn, easeInOut, easeOut, type Look } from './actors/Smurf';
import type { GargamelActor } from './actors/Gargamel';
import type { Obstacles } from './world/Obstacles';
import type { Fx } from './fx';
import { BASE_SPEED, CATCH_X, GARG_BASE_X, HERD_MIN, LANES, W } from './config';

export type GameEvent =
  | { type: 'start' }
  | { type: 'progress'; t: number; duration: number; intensity: number }
  | { type: 'charge' }
  | { type: 'catch'; student: RosterEntry; inBag: number; final: boolean }
  | { type: 'escape'; student: RosterEntry; inBag: number }
  | { type: 'struggle' }
  | { type: 'whiff' }
  | { type: 'miss' }
  | { type: 'stumble' }
  | { type: 'trip' }
  | { type: 'laugh' }
  | { type: 'end' };

interface Cue {
  t: number;
  run: () => void;
}

const LUNGE_WINDUP = 0.42;
const TRIP_X = 1010;
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export interface DirectorOptions {
  maxVisible: number;
  reduceMotion: boolean;
}

export class Director {
  readonly actors: SmurfActor[] = [];
  private readonly roster = new Map<number, RosterEntry>();
  private readonly loc = new Map<number, 'off' | 'stage' | 'bag'>();
  private readonly actorOf = new Map<number, SmurfActor>();
  private readonly looks = new Map<number, Look>();
  private offQueue: number[] = [];
  private variantBase = -1;
  private readonly cues: Cue[] = [];
  private cueIdx = 0;
  private readonly catchTimes: number[] = [];
  private readonly busy: [number, number][] = [];
  private readonly upcoming = new Map<number, number[]>(); // sid → các mốc bị chộp
  private nextRotate = 4;
  private inBag = 0;
  private struggleTarget = 0.15;
  herdMin = HERD_MIN;
  readonly slowmo: [number, number][] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly assets: AssetRegistry,
    private readonly script: DrawScript,
    rosterList: RosterEntry[],
    private readonly garg: GargamelActor,
    private readonly obstacles: Obstacles,
    private readonly fx: Fx,
    private readonly rng: ChaChaRng,
    private readonly noise: Noise1D,
    private readonly opts: DirectorOptions,
    private readonly emit: (e: GameEvent) => void,
  ) {
    for (const r of rosterList) this.roster.set(r.id, r);
    for (const id of script.poolIds) this.loc.set(id, 'off');
    for (const e of script.events) {
      if (e.type === 'CATCH') {
        this.catchTimes.push(e.t / 1000);
        const arr = this.upcoming.get(e.studentId) ?? [];
        arr.push(e.t / 1000);
        this.upcoming.set(e.studentId, arr);
        this.slowmo.push([e.t / 1000 - 0.05, e.t / 1000 + 0.11]);
        this.busy.push([e.t / 1000 - 2.6, e.t / 1000 + 0.8]);
      } else if (e.type === 'ESCAPE') this.busy.push([e.t / 1000 - 1.2, e.t / 1000 + 1.4]);
      else this.busy.push([e.t / 1000 - 2.6, e.t / 1000 + 1.6]);
    }
    this.setupStage();
    this.buildCues();
  }

  // ------------------------------------------------------------------ đàn xì trum

  private student(id: number): RosterEntry {
    return this.roster.get(id) ?? { id, mssv: '', fullName: `SV ${id}`, label: `SV ${id}` };
  }

  private lookOf(id: number): Look {
    let l = this.looks.get(id);
    if (!l) {
      const tints = [0xffffff, 0xeef6ff, 0xf3efff, 0xecfff6, 0xfff6ec, 0xe8f1ff];
      const acc: string[] = [];
      if (this.rng.chance(0.35)) acc.push('acc_badge');
      if (this.rng.chance(0.25)) acc.push('acc_glasses');
      if (this.rng.chance(0.28)) acc.push('acc_backpack');
      else if (this.rng.chance(0.22)) acc.push('acc_book');
      if (this.rng.chance(0.16)) acc.push('acc_pencil');
      // biến thể art: xoay vòng từ một điểm ngẫu nhiên ⇒ 5 người đầu tiên xuất hiện có đủ 5 biến thể
      const variants = this.assets.kidVariants;
      if (this.variantBase < 0) this.variantBase = variants.length ? this.rng.int(variants.length) : 0;
      const variant = variants.length ? variants[(this.variantBase + this.looks.size) % variants.length] : '';
      l = { tint: this.rng.pick(tints), accessories: acc, variant };
      this.looks.set(id, l);
    }
    return l;
  }

  private freeActor(): SmurfActor {
    let a = this.actors.find((x) => x.state === 'off');
    if (!a) {
      a = new SmurfActor(this.scene, this.assets);
      this.actors.push(a);
    }
    return a;
  }

  private visibleCount() {
    return this.actors.filter((a) => a.active && a.mode !== 'exit').length;
  }

  private leastCrowdedLane(): number {
    const counts = LANES.map(() => 0);
    for (const a of this.actors) if (a.active) counts[a.lane]++;
    const min = Math.min(...counts);
    const lanes = counts.map((c, i) => (c === min ? i : -1)).filter((i) => i >= 0);
    return this.rng.pick(lanes);
  }

  private reserved(sid: number, t: number, ahead = 14) {
    return (this.upcoming.get(sid) ?? []).some((tc) => tc >= t - 0.5 && tc <= t + ahead);
  }

  private setupStage() {
    const pool = [...this.script.poolIds];
    const C = Math.max(4, this.opts.maxVisible);
    let onStage: number[];
    if (pool.length <= C) onStage = this.rng.shuffle(pool);
    else {
      const early: number[] = [];
      for (const e of this.script.events) {
        if (e.type === 'CATCH' && e.t < 12_000 && !early.includes(e.studentId)) early.push(e.studentId);
      }
      const rest = this.rng.shuffle(pool.filter((id) => !early.includes(id)));
      onStage = this.rng.shuffle([...early, ...rest].slice(0, C));
      this.offQueue = rest.filter((id) => !onStage.includes(id));
    }
    const span = 960;
    onStage.forEach((sid, i) => {
      const a = this.freeActor();
      const x = 860 + ((i + 0.5) * span) / onStage.length + this.rng.range(-30, 30);
      a.assign(this.student(sid), this.lookOf(sid), x, i % LANES.length, 'herd', this.rng);
      this.loc.set(sid, 'stage');
      this.actorOf.set(sid, a);
    });
  }

  private enter(sid: number) {
    if (this.loc.get(sid) !== 'off') return;
    this.offQueue = this.offQueue.filter((id) => id !== sid);
    const a = this.freeActor();
    a.assign(this.student(sid), this.lookOf(sid), W + 80 + this.rng.range(0, 60), this.leastCrowdedLane(), 'enter', this.rng);
    a.enterStopX = this.rng.range(1480, 1760);
    this.loc.set(sid, 'stage');
    this.actorOf.set(sid, a);
  }

  private exitOne(t: number): boolean {
    let best: SmurfActor | null = null;
    for (const a of this.actors) {
      if (!a.active || a.mode !== 'herd' || a.state !== 'run' || a.scripted || !a.student) continue;
      if (this.reserved(a.student.id, t) || a.x < 1250) continue;
      if (!best || a.x > best.x) best = a;
    }
    if (!best) return false;
    best.mode = 'exit';
    return true;
  }

  /** Đảm bảo SV có mặt trên màn hình (ít nhất vài giây trước khi bị bắt). */
  private ensureVisible(sid: number, t: number) {
    if (this.loc.get(sid) !== 'off') return;
    this.enter(sid);
    if (this.visibleCount() > this.opts.maxVisible) this.exitOne(t);
  }

  private rotate(t: number) {
    if (t < this.nextRotate) return;
    this.nextRotate = t + this.rng.range(3.4, 5.4);
    const candidates = this.offQueue.filter((id) => this.loc.get(id) === 'off');
    if (candidates.length === 0) return;
    if (this.exitOne(t) || this.visibleCount() < this.opts.maxVisible) this.enter(candidates[0]);
  }

  private syncReleased() {
    for (const [sid, a] of this.actorOf) {
      if (a.student?.id !== sid) {
        this.actorOf.delete(sid);
        if (this.loc.get(sid) === 'stage') {
          this.loc.set(sid, 'off');
          this.offQueue.push(sid);
        }
      }
    }
  }

  private pickDecoy(t: number, exclude: number): SmurfActor | null {
    let best: SmurfActor | null = null;
    for (const a of this.actors) {
      if (!a.active || a.state !== 'run' || a.mode !== 'herd' || a.scripted || !a.student) continue;
      if (a.student.id === exclude || this.reserved(a.student.id, t, 5)) continue;
      if (a.x < 880 || a.x > 1650) continue;
      if (!best || a.x < best.x) best = a;
    }
    return best;
  }

  // ------------------------------------------------------------------ kịch bản → cue

  /** Thêm cue, giữ danh sách luôn sắp xếp theo thời gian (kể cả cue thêm trong lúc chạy). */
  private at(t: number, run: () => void) {
    const cue = { t: Math.max(0, t), run };
    let i = this.cues.length;
    while (i > this.cueIdx && this.cues[i - 1].t > cue.t) i--;
    this.cues.splice(i, 0, cue);
  }

  private actorFor(sid: number, t: number): SmurfActor {
    let a = this.actorOf.get(sid);
    if (!a) {
      // dự phòng: luôn bảo đảm có xì trum để bắt
      this.ensureVisible(sid, t);
      a = this.actorOf.get(sid)!;
    }
    return a;
  }

  private buildCues() {
    const ev = this.script.events;
    const reach = this.garg.reach;
    // màn mở đầu: Gargamel lao vào từ bên trái
    this.at(0, () => {
      this.garg.moveTo(GARG_BASE_X, 1.6, easeOut);
      this.emit({ type: 'start' });
    });
    this.at(0.7, () => this.emit({ type: 'laugh' }));

    ev.forEach((e: ScriptEvent, i) => {
      const t = e.t / 1000;
      const prevEnd = i === 0 ? 1.8 : ev[i - 1].t / 1000 + 0.6;
      const room = t - prevEnd;
      if (e.type === 'CATCH') {
        const sid = e.studentId;
        const catchX = e.style === 'feint' ? CATCH_X + 40 : CATCH_X;
        this.at(t - 9, () => this.ensureVisible(sid, t - 9));
        this.at(t - 4.5, () => this.ensureVisible(sid, t - 4.5));

        if (e.style === 'trip') {
          const tTrip = t - 1.5;
          const A = Phaser.Math.Clamp(tTrip - prevEnd, 0.6, 2.2);
          this.at(tTrip - A, () => {
            const a = this.actorFor(sid, tTrip - A);
            a.scripted = true;
            a.path = { x1: TRIP_X, t1: tTrip, ease: easeInOut };
          });
          this.at(tTrip - 1.9, () => {
            const o = this.obstacles.spawn(this.rng.pick(['obs_root', 'obs_rock', 'obs_bucket', 'obs_post']), W + 220, {
              forStudent: sid,
              aim: { x: TRIP_X + 24, t: tTrip },
            });
            this.obstacles.markSpawn(tTrip - 1.9);
            void o;
          });
          this.at(tTrip, () => {
            const a = this.actorFor(sid, tTrip);
            a.trip();
            a.path = { x1: catchX, t1: t, ease: easeOut };
            this.fx.dust(a.x + 30, a.laneY, 3, 0.8);
            this.emit({ type: 'trip' });
          });
        } else if (e.style === 'feint') {
          const t1 = t - 1.3;
          const A = Phaser.Math.Clamp(t1 - prevEnd, 0.9, 2.5);
          this.at(t1 - A, () => {
            const a = this.actorFor(sid, t1 - A);
            a.scripted = true;
            a.path = { x1: CATCH_X + 10, t1, ease: easeInOut };
          });
          this.at(t1 - 1.0, () => this.garg.moveTo(CATCH_X + 10 - reach - 70, t1 - LUNGE_WINDUP, easeInOut));
          this.at(t1 - LUNGE_WINDUP, () => {
            this.garg.lunge(t1, t1 - LUNGE_WINDUP, true);
            this.garg.moveTo(CATCH_X + 10 - reach, t1, easeOut);
          });
          this.at(t1 - 0.14, () => {
            const a = this.actorFor(sid, t1);
            a.sweating = true;
            a.jump();
            a.path = { x1: CATCH_X + 200, t1: t1 + 0.5, ease: easeOut };
          });
          this.at(t1, () => {
            const [bx, by] = this.garg.bagMouth();
            this.fx.dust(bx, by + 60, 5, 1);
            this.emit({ type: 'whiff' });
          });
          this.at(t1 + 0.5, () => {
            const a = this.actorFor(sid, t1 + 0.5);
            a.path = { x1: catchX, t1: t, ease: easeIn };
          });
        } else {
          const A = Phaser.Math.Clamp(room, 0.9, 3.2);
          this.at(t - A - 2, () => {
            const a = this.actorOf.get(sid);
            if (a && !a.scripted) a.bias = -0.05;
          });
          this.at(t - A, () => {
            const a = this.actorFor(sid, t - A);
            a.scripted = true;
            a.bias = 0;
            a.path = { x1: catchX, t1: t, ease: easeInOut };
            // mồi nhử: một xì trum khác cũng tụt lại → khán giả không đoán được ai bị bắt
            if (A >= 1.7) {
              const d = this.pickDecoy(t - A, sid);
              if (d) {
                d.scripted = true;
                d.path = { x1: catchX + this.rng.range(150, 230), t1: t - 0.75, ease: easeInOut };
                this.at(t - 0.75, () => {
                  d.sweating = false;
                  d.path = { x1: Math.min(1500, d.x + 360), t1: t + 0.7, ease: easeIn };
                });
                this.at(t + 0.75, () => {
                  if (d.student) {
                    d.path = null;
                    d.scripted = false;
                    d.setBoost(0.3, t + 2.5);
                  }
                });
                this.at(t - Math.min(1.4, A), () => (d.sweating = true));
              }
            }
          });
        }
        this.at(t - Math.min(1.3, Math.max(0.5, room * 0.7)), () => {
          const a = this.actorOf.get(sid);
          if (a) a.sweating = true;
        });

        // Gargamel tăng tốc rồi vồ
        const chargeAt = t - Math.min(1.2, Math.max(0.5, room * 0.6));
        this.at(chargeAt, () => {
          this.garg.moveTo(catchX - reach - 70, t - LUNGE_WINDUP, easeInOut);
          this.emit({ type: 'charge' });
        });
        this.at(t - LUNGE_WINDUP, () => {
          this.garg.lunge(t, t - LUNGE_WINDUP);
          this.garg.moveTo(catchX - reach, t, easeOut);
        });
        this.at(t, () => this.doCatch(sid, e.attempt === ev.filter((x) => x.type === 'CATCH').length - 1, t));
      } else if (e.type === 'ESCAPE') {
        this.at(t - 1.0, () => {
          this.struggleTarget = 1;
          this.garg.stagger(t - 1.0, 1.0);
          this.emit({ type: 'struggle' });
        });
        this.at(t, () => this.doEscape(e.studentId, t));
      } else if (e.kind === 'whiff') {
        let decoy: SmurfActor | null = null;
        this.at(t - 2.4, () => {
          decoy = this.pickDecoy(t - 2.4, -1);
          if (decoy) {
            decoy.scripted = true;
            decoy.path = { x1: CATCH_X + 20, t1: t, ease: easeInOut };
          }
        });
        this.at(t - 1.3, () => decoy && (decoy.sweating = true));
        this.at(t - 1.1, () => {
          this.garg.moveTo(CATCH_X + 20 - reach - 70, t - LUNGE_WINDUP, easeInOut);
          this.emit({ type: 'charge' });
        });
        this.at(t - LUNGE_WINDUP, () => {
          this.garg.lunge(t, t - LUNGE_WINDUP, true);
          this.garg.moveTo(CATCH_X + 20 - reach + 30, t, easeOut);
        });
        this.at(t - 0.14, () => {
          if (decoy?.student) {
            decoy.jump();
            decoy.path = { x1: CATCH_X + 300, t1: t + 0.55, ease: easeOut };
          }
        });
        this.at(t, () => {
          this.garg.fall(t);
          const [bx, by] = this.garg.bagMouth();
          this.fx.dust(bx + 40, by + 80, 6, 1.2);
          this.fx.stars(bx + 20, by - 40, 4);
          this.emit({ type: 'miss' });
        });
        this.at(t + 0.6, () => {
          if (decoy?.student) {
            decoy.sweating = false;
            decoy.path = null;
            decoy.scripted = false;
            decoy.setBoost(0.35, t + 2.6);
          }
        });
      } else {
        // Gargamel tự vấp rễ cây
        const gx = GARG_BASE_X + 70;
        this.at(t - 2.2, () => {
          this.garg.moveTo(gx, t, easeInOut);
          this.obstacles.spawn('obs_root', W + 300, { forGargamel: true, aim: { x: gx + 120, t } });
          this.obstacles.markSpawn(t - 2.2);
        });
        this.at(t, () => {
          this.garg.fall(t);
          this.fx.dust(gx + 120, LANES[2], 6, 1.2);
          this.emit({ type: 'stumble' });
        });
      }
    });
  }

  private doCatch(sid: number, final: boolean, t: number) {
    const a = this.actorFor(sid, t);
    a.scripted = false;
    this.garg.openBag();
    const [bx, by] = this.garg.bagMouth();
    this.fx.stars(bx, by + 30, 8);
    this.fx.dust(a.x, a.laneY, 5, 1.1);
    this.inBag++;
    this.garg.bagCount = this.inBag;
    this.loc.set(sid, 'bag');
    a.caught(() => {
      if (this.actorOf.get(sid) === a) this.actorOf.delete(sid);
      a.release();
    });
    if (!this.opts.reduceMotion) this.scene.cameras.main.shake(220, 0.006);
    this.emit({ type: 'catch', student: this.student(sid), inBag: this.inBag, final });
    if (final) this.at(t + 0.9, () => this.emit({ type: 'laugh' }));
  }

  private doEscape(sid: number, t: number) {
    this.struggleTarget = 0.15;
    this.garg.bagStruggle = 0;
    this.inBag = Math.max(0, this.inBag - 1);
    this.garg.bagCount = this.inBag;
    const a = this.freeActor();
    const lane = this.leastCrowdedLane();
    const [bx, by] = this.garg.bagMouth();
    a.assign(this.student(sid), this.lookOf(sid), bx, lane, 'herd', this.rng);
    a.popFrom([bx, by], this.rng.range(1080, 1220), lane, () => this.fx.dust(a.x, a.laneY, 5, 1));
    this.loc.set(sid, 'stage');
    this.actorOf.set(sid, a);
    this.garg.angry(t + 0.05, 1.0);
    this.fx.stars(bx, by, 5);
    if (!this.opts.reduceMotion) this.scene.cameras.main.shake(160, 0.004);
    this.emit({ type: 'escape', student: this.student(sid), inBag: this.inBag });
  }

  // ------------------------------------------------------------------ nhịp độ

  /** 0..1: mức "dồn" trước mỗi lần chộp. */
  charge(t: number): number {
    let c = 0;
    for (const tc of this.catchTimes) {
      if (t >= tc - 1.6 && t <= tc) c = Math.max(c, smooth((t - (tc - 1.6)) / 1.6));
      else if (t > tc && t < tc + 0.8) c = Math.max(c, 1 - smooth((t - tc) / 0.8));
    }
    return c;
  }

  private dip(t: number): number {
    let d = 0;
    for (const tc of this.catchTimes) {
      if (t > tc + 0.3 && t < tc + 2.3) d = Math.max(d, Math.sin(((t - tc - 0.3) / 2) * Math.PI));
    }
    return d;
  }

  worldSpeed(t: number): number {
    const D = this.script.durationMs / 1000;
    const wave = 1 + 0.08 * Math.sin((2 * Math.PI * t) / 11) + 0.05 * Math.sin((2 * Math.PI * t) / 4.3 + 1);
    const finale = 1 + 0.12 * smooth((t - (D - 10)) / 8);
    return BASE_SPEED * wave * (1 + 0.28 * this.charge(t) - 0.15 * this.dip(t)) * finale;
  }

  private nearAction(t: number) {
    return this.busy.some(([a, b]) => t >= a && t <= b);
  }

  // ------------------------------------------------------------------ cập nhật mỗi bước

  update(t: number, dt: number, ws: number) {
    while (this.cueIdx < this.cues.length && this.cues[this.cueIdx].t <= t) {
      this.cues[this.cueIdx++].run();
    }
    const busy = this.nearAction(t);
    this.herdMin = busy ? 950 : HERD_MIN;
    this.rotate(t);
    this.obstacles.auto(t, busy);

    // va chạm chướng ngại: nhảy qua hoặc vấp
    for (const o of this.obstacles.list) {
      for (const a of this.actors) {
        if (!a.active || !a.student || o.handled.has(a.id)) continue;
        // khoảng cách từ mũi chân xì trum tới mép trái hitbox (quy đổi theo scale)
        const d = o.x + o.left - (a.x + 18);
        if (d < 45 && o.x + o.right > a.x - 20) {
          o.handled.add(a.id);
          if (o.forStudent === a.student.id) continue; // cú vấp do kịch bản (cue)
          if (a.state !== 'run') continue;
          const canTrip =
            !a.scripted && !busy && a.x > 1200 && a.mode === 'herd' && !this.reserved(a.student.id, t, 5);
          if (canTrip && this.rng.chance(0.3)) {
            a.trip();
            this.fx.dust(a.x + 20, a.laneY, 2, 0.7);
            this.emit({ type: 'trip' });
          } else a.jump();
        }
      }
      const dg = o.x + o.left - (this.garg.x + 60);
      if (dg < 110 && o.x + o.right > this.garg.x && !o.handled.has(0)) {
        o.handled.add(0);
        if (!o.forGargamel) this.garg.hop();
      }
    }

    // túi giãy
    this.garg.bagStruggle += ((this.inBag > 0 ? this.struggleTarget : 0) - this.garg.bagStruggle) * Math.min(1, dt * 4);
    this.garg.update(t, dt, ws, this.noise);
    const mouth = this.garg.bagMouth();
    for (const a of this.actors) a.update(t, dt, ws, this.noise, this.actors, this.herdMin, mouth);
    this.syncReleased();
    this.fx.speedLines(this.charge(t), t);
  }
}
