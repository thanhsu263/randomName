/**
 * Âm thanh:
 * - Nhạc nền & jingle: file MP3 gốc Smurfs Epic Run khai báo trong manifest (HTMLAudioElement, đổi playbackRate được).
 * - SFX còn thiếu (bước chạy, vấp, "phụp" vào túi, bật ra, tiếng cười Gargamel, trống dồn…) tổng hợp bằng WebAudio.
 */
import { ChaChaRng } from '@shared/rng';
import type { AudioSpec, Manifest } from '../game/assets';

export type Sfx = 'bag' | 'pop' | 'trip' | 'whoosh' | 'drumroll' | 'laugh' | 'stomp' | 'click' | 'thud' | 'step';

export class AudioManager {
  private specs: Record<string, AudioSpec> = {};
  private enabled = true;
  private music: HTMLAudioElement | null = null;
  private musicKey: string | null = null;
  private musicVol = 1;
  private duckLevel = 1;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private fades = new Map<HTMLAudioElement, number>();
  private jingles = new Set<HTMLAudioElement>();
  private wantMusic: { key: string; rate: number } | null = null;

  setManifest(m: Manifest) {
    this.specs = m.audio;
  }

  get isEnabled() {
    return this.enabled;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.music?.pause();
      for (const j of this.jingles) j.pause();
      this.jingles.clear();
    } else if (this.wantMusic) {
      const w = this.wantMusic;
      this.musicKey = null;
      this.playMusic(w.key, w.rate);
    }
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  /** Gọi trong một thao tác của người dùng để trình duyệt cho phép phát âm thanh. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      const rng = new ChaChaRng('ab'.repeat(32), 3);
      for (let i = 0; i < len; i++) d[i] = rng.float() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.enabled && this.music && this.music.paused && this.wantMusic) void this.music.play().catch(() => {});
  }

  private src(key: string) {
    const s = this.specs[key];
    return s ? `/assets/${s.path}` : null;
  }

  private fadeTo(el: HTMLAudioElement, target: number, ms: number, done?: () => void) {
    const prev = this.fades.get(el);
    if (prev) clearInterval(prev);
    const start = el.volume;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const u = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
      el.volume = Math.max(0, Math.min(1, start + (target - start) * u));
      if (u >= 1) {
        clearInterval(id);
        this.fades.delete(el);
        done?.();
      }
    }, 30);
    this.fades.set(el, id);
  }

  playMusic(key: string, rate = 1) {
    this.wantMusic = { key, rate };
    if (this.musicKey === key && this.music) {
      this.setMusicRate(rate);
      if (this.enabled && this.music.paused) void this.music.play().catch(() => {});
      return;
    }
    this.stopMusic(500);
    const url = this.src(key);
    if (!url) return;
    const spec = this.specs[key];
    const el = new Audio(url);
    el.loop = spec.loop ?? true;
    el.preload = 'auto';
    this.musicVol = spec.volume ?? 0.5;
    el.volume = 0;
    (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    el.playbackRate = rate;
    this.music = el;
    this.musicKey = key;
    if (this.enabled) {
      void el.play().catch(() => {
        /* chờ unlock() */
      });
      this.fadeTo(el, this.musicVol * this.duckLevel, 700);
    }
  }

  stopMusic(fadeMs = 400) {
    const el = this.music;
    this.music = null;
    this.musicKey = null;
    if (!el) return;
    this.fadeTo(el, 0, fadeMs, () => {
      el.pause();
      el.src = '';
    });
  }

  clearMusicIntent() {
    this.wantMusic = null;
  }

  setMusicRate(rate: number) {
    if (this.wantMusic) this.wantMusic.rate = rate;
    if (this.music && Math.abs(this.music.playbackRate - rate) > 0.004) this.music.playbackRate = rate;
  }

  private duck(level: number, ms: number) {
    this.duckLevel = level;
    if (this.music) this.fadeTo(this.music, this.musicVol * level, ms);
  }

  jingle(key: string, onEnded?: () => void) {
    const url = this.src(key);
    if (!url || !this.enabled) {
      onEnded?.();
      return;
    }
    const spec = this.specs[key];
    const el = new Audio(url);
    el.volume = spec.volume ?? 0.6;
    if (spec.start) el.currentTime = spec.start;
    this.jingles.add(el);
    this.duck(0.35, 150);
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      this.jingles.delete(el);
      if (this.jingles.size === 0) this.duck(1, 500);
      onEnded?.();
    };
    el.addEventListener('ended', end);
    if (spec.maxDuration) {
      window.setTimeout(() => {
        this.fadeTo(el, 0, 250, () => {
          el.pause();
          end();
        });
      }, spec.maxDuration * 1000);
    }
    void el.play().catch(end);
  }

  // ------------------------------------------------------------------ SFX tổng hợp

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(filter: BiquadFilterType, freq: number, dur: number, vol: number, when = 0, freqEnd?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, (when * 7919) % 0.5);
    s.stop(t + dur + 0.05);
  }

  sfx(name: Sfx) {
    if (!this.enabled || !this.ctx || !this.master) return;
    switch (name) {
      case 'bag': // "phụp" vào túi
        this.tone('sine', 140, 45, 0.22, 0.7);
        this.burst('lowpass', 900, 0.14, 0.5);
        break;
      case 'pop': // bật ra khỏi túi
        this.tone('sine', 260, 980, 0.16, 0.5);
        this.tone('triangle', 520, 1400, 0.12, 0.25, 0.05);
        break;
      case 'trip':
        this.tone('triangle', 620, 160, 0.32, 0.35);
        this.burst('lowpass', 500, 0.12, 0.3, 0.22);
        break;
      case 'whoosh':
        this.burst('bandpass', 400, 0.32, 0.45, 0, 2400);
        break;
      case 'thud':
        this.tone('sine', 110, 40, 0.3, 0.7);
        this.burst('lowpass', 400, 0.25, 0.5);
        break;
      case 'stomp':
        for (let i = 0; i < 3; i++) {
          this.tone('sine', 95, 40, 0.16, 0.55, i * 0.22);
          this.burst('lowpass', 300, 0.1, 0.35, i * 0.22);
        }
        break;
      case 'drumroll': {
        // trống dồn trước khi chộp
        let tt = 0;
        let i = 0;
        while (tt < 1.25) {
          const v = 0.1 + 0.35 * (tt / 1.25);
          this.burst('bandpass', 1900, 0.05, v, tt);
          if (i % 4 === 0) this.tone('sine', 120, 70, 0.08, v * 0.8, tt);
          tt += 0.11 - 0.065 * (tt / 1.25);
          i++;
        }
        break;
      }
      case 'laugh': {
        // "Hé hé hé!" kiểu Gargamel
        const ctx = this.ctx;
        for (let i = 0; i < 5; i++) {
          const t = ctx.currentTime + i * 0.17;
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(190 - i * 9, t);
          o.frequency.exponentialRampToValueAtTime(130 - i * 6, t + 0.12);
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 900;
          f.Q.value = 3;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
          o.connect(f).connect(g).connect(this.master);
          o.start(t);
          o.stop(t + 0.16);
          this.burst('highpass', 2500, 0.05, 0.12, i * 0.17);
        }
        break;
      }
      case 'click':
        this.tone('square', 900, 600, 0.05, 0.12);
        break;
      case 'step':
        this.burst('lowpass', 700, 0.05, 0.15);
        break;
    }
  }
}

export const audio = new AudioManager();
