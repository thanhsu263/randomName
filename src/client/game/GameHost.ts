// Vỏ bọc Phaser.Game: khởi tạo 1 lần, tái sử dụng cho mọi lượt rượt đuổi.
//
// Lưu ý kích thước: game có thể được tạo sẵn khi #stage còn ẩn (display:none) → ScaleManager đọc
// kích thước parent = 0x0 và đặt canvas 0x0 (màn hình đen). Vì vậy:
//  - ResizeObserver trên parent gọi scale.refresh() mỗi khi parent đổi kích thước (kể cả 0 → hiện);
//  - run() đợi 2 khung hình sau khi stage hiện rồi refresh lại cho chắc.
import Phaser from 'phaser';
import { BootScene, ChaseScene, HudScene, type ChaseData } from './scenes';
import { loadManifest } from './assets';
import { H, W } from './config';

/** Đợi 1 khung hình (có timeout dự phòng khi tab chạy nền và rAF bị tạm dừng). */
const nextFrame = () =>
  new Promise<void>((r) => {
    const done = () => {
      clearTimeout(timer);
      r();
    };
    const timer = setTimeout(done, 60);
    requestAnimationFrame(done);
  });

export class GameHost {
  private game: Phaser.Game | null = null;
  private readyPromise: Promise<void> | null = null;
  private observer: ResizeObserver | null = null;

  constructor(private readonly parent: HTMLElement) {}

  init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = loadManifest().then(
      (manifest) =>
        new Promise<void>((resolve) => {
          this.game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: this.parent,
            width: W,
            height: H,
            backgroundColor: '#000000',
            scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
            render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
            fps: { target: 60, smoothStep: true },
            audio: { noAudio: true },
            banner: false,
            scene: [],
          });
          // công cụ debug khi phát triển (không có trong bản build)
          if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = this.game;
          this.game.scene.add('chase', ChaseScene, false);
          this.game.scene.add('hud', HudScene, false);
          this.game.scene.add('boot', BootScene, true, { manifest, onReady: () => resolve() });
          if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(() => this.refresh());
            this.observer.observe(this.parent);
          }
        }),
    );
    return this.readyPromise;
  }

  async run(data: ChaseData) {
    await this.init();
    const g = this.game!;
    g.scene.stop('hud');
    g.scene.stop('chase');
    // stage vừa được hiện: đợi trình duyệt tính layout rồi mới đo lại kích thước parent
    await nextFrame();
    this.refresh();
    g.scene.start('chase', data);
    await nextFrame();
    this.refresh();
  }

  skip() {
    const chase = this.game?.scene.getScene('chase') as ChaseScene | undefined;
    chase?.finish(true);
  }

  stop() {
    this.game?.scene.stop('hud');
    this.game?.scene.stop('chase');
  }

  refresh() {
    const g = this.game;
    if (!g) return;
    const w = this.parent.clientWidth;
    const h = this.parent.clientHeight;
    if (w === 0 || h === 0) return; // đang ẩn — sẽ refresh khi hiện
    g.scale.getParentBounds();
    g.scale.refresh();
  }
}
