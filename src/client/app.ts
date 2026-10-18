// Điều phối các màn hình: Setup → Rượt đuổi → Kết quả (→ Lịch sử / Phát lại).
import type { DrawRecord } from '@shared/types';
import { api } from './api';
import { audio } from './audio/AudioManager';
import { GameHost } from './game/GameHost';
import type { GameEvent } from './game/Director';
import { loadSettings, saveSettings, type Settings } from './state';
import { beginLoading, isBlocking } from './ui/loading';
import { modalOpen, toast } from './ui/modal';
import { renderSetup } from './screens/setup';
import { renderResult } from './screens/result';
import { renderHistory } from './screens/history';

export type ScreenName = 'setup' | 'chase' | 'result' | 'history';

const CHASE_MUSIC = ['music_forest', 'music_plain', 'music_mountain'];

export class App {
  settings: Settings = loadSettings();
  current: ScreenName = 'setup';
  readonly screen = document.getElementById('screen')!;
  private readonly stage = document.getElementById('stage')!;
  readonly game = new GameHost(document.getElementById('game')!);
  /** hành động phím Space ở màn hiện tại */
  primaryAction: (() => void) | null = null;
  private starting = false;

  save() {
    saveSettings(this.settings);
    document.body.classList.toggle('reduce-motion', this.settings.reduceMotion);
  }

  private showScreen(name: ScreenName) {
    this.current = name;
    const chasing = name === 'chase';
    this.stage.hidden = !chasing;
    this.screen.hidden = chasing;
    document.body.classList.toggle('chasing', chasing);
    if (!chasing) this.game.stop();
    this.primaryAction = null;
    this.screen.scrollTop = 0;
  }

  async showSetup() {
    this.showScreen('setup');
    audio.playMusic('music_menu');
    await renderSetup(this);
  }

  async showHistory() {
    this.showScreen('history');
    audio.playMusic('music_offgame');
    await renderHistory(this);
  }

  /** Tạo lượt gọi mới (server sinh seed + kịch bản + lưu DB) rồi chạy màn rượt đuổi. */
  async startDraw() {
    if (this.starting) return;
    const s = this.settings;
    if (!s.classId) {
      toast('Hãy chọn lớp trước', 'error');
      return;
    }
    this.starting = true;
    // giữ màn chắn suốt từ lúc bấm tới khi màn rượt đuổi đã khởi động: không thể bấm "XUẤT KÍCH" lần nữa
    const endLoading = beginLoading({ block: true, message: 'Gargamel đang xuất kích' });
    try {
      const draw = await api.createDraw(s.classId, {
        n: s.n,
        escapeProb: s.escapePct / 100,
        duration: s.durationMode === 'random' ? { mode: 'random' } : { mode: 'fixed', ms: s.fixedSec * 1000 },
        excludeCalled: s.excludeCalled,
      });
      await this.playChase(draw, false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      endLoading();
      this.starting = false;
    }
  }

  async playChase(draw: DrawRecord, replay: boolean) {
    this.showScreen('chase');
    const endLoading = beginLoading({ block: true, message: 'Gargamel đang xuất kích' }); // khởi động Phaser có thể mất ~1 giây
    audio.clearMusicIntent();
    audio.stopMusic(300);
    const D = draw.script.durationMs / 1000;
    let musicStarted = false;
    const onEvent = (e: GameEvent) => {
      switch (e.type) {
        case 'start':
          if (!musicStarted) {
            musicStarted = true;
            audio.playMusic(CHASE_MUSIC[draw.script.musicIndex % CHASE_MUSIC.length], 1);
          }
          audio.sfx('whoosh');
          break;
        case 'progress':
          audio.setMusicRate(1 + 0.1 * Math.min(1, Math.max(0, (e.t - (D - 10)) / 10)));
          break;
        case 'charge':
          audio.sfx('drumroll');
          break;
        case 'catch':
          audio.sfx('bag');
          audio.jingle('jingle_catch');
          break;
        case 'escape':
          audio.sfx('pop');
          audio.jingle('jingle_escape');
          setTimeout(() => audio.sfx('stomp'), 250);
          break;
        case 'whiff':
          audio.sfx('whoosh');
          break;
        case 'miss':
          audio.sfx('whoosh');
          setTimeout(() => audio.sfx('thud'), 220);
          break;
        case 'stumble':
          audio.sfx('thud');
          break;
        case 'trip':
          audio.sfx('trip');
          break;
        case 'laugh':
          audio.sfx('laugh');
          break;
      }
    };
    try {
      await this.game.run({
        draw,
        replay,
        reduceMotion: this.settings.reduceMotion,
        hideTimer: this.settings.hideTimer,
        maxVisible: this.settings.maxVisible,
        onEvent,
        onFinish: () => this.showResult(draw, replay),
      });
    } catch (e) {
      console.error(e);
      toast('Không khởi động được màn rượt đuổi — chuyển thẳng tới kết quả', 'error');
      this.showResult(draw, replay);
    } finally {
      endLoading();
    }
  }

  showResult(draw: DrawRecord, replay: boolean) {
    this.showScreen('result');
    audio.clearMusicIntent();
    audio.stopMusic(200);
    audio.jingle('jingle_win', () => {
      if (this.current === 'result') audio.playMusic('music_offgame');
    });
    renderResult(this, draw, replay);
  }

  skip() {
    if (this.current === 'chase') this.game.skip();
  }

  toggleMute() {
    this.settings.sound = !this.settings.sound;
    this.save();
    audio.setEnabled(this.settings.sound);
    this.syncToolbar();
  }

  syncToolbar() {
    const b = document.getElementById('mute-btn')!;
    b.textContent = this.settings.sound ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(!this.settings.sound));
    document.dispatchEvent(new CustomEvent('settings-changed'));
  }

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      audio.unlock();
      if (isBlocking() || modalOpen()) return; // đang chờ server: bỏ qua phím tắt (Space, S, M, F)
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (typing && e.key !== 'Escape') {
        if (!(tag === 'INPUT' && ['range', 'checkbox', 'radio'].includes((e.target as HTMLInputElement).type))) return;
      }
      const k = e.key.toLowerCase();
      if (e.code === 'Space' || k === ' ') {
        if (this.primaryAction) {
          e.preventDefault();
          this.primaryAction();
        }
      } else if (k === 's' && this.current === 'chase') {
        e.preventDefault();
        this.skip();
      } else if (k === 'm') {
        this.toggleMute();
      } else if (k === 'f') {
        toggleFullscreen();
      }
    });
    document.addEventListener('pointerdown', () => audio.unlock());
  }
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => toast('Trình duyệt không cho phép toàn màn hình', 'error'));
}
