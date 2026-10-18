// Điểm vào frontend.
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './styles.css';
import { App, toggleFullscreen } from './app';
import { audio } from './audio/AudioManager';
import { loadManifest } from './game/assets';
import { h } from './ui/dom';
import { openModal } from './ui/modal';

const VI_SAMPLE = 'Aa ĐƯỜNG Trường Đại học Sài Gòn ắẫệồỡựỹ';

async function loadFonts() {
  // ép tải cả subset tiếng Việt (unicode-range) trước khi vẽ chữ lên canvas
  await Promise.all(
    ['800 40px "Baloo 2"', '700 40px "Baloo 2"', '400 20px "Be Vietnam Pro"', '700 20px "Be Vietnam Pro"'].map((f) =>
      document.fonts.load(f, VI_SAMPLE).catch(() => []),
    ),
  );
}

function showCredits() {
  openModal(
    'Ghi nguồn',
    h(
      'div',
      { class: 'modal-text' },
      h('p', {}, h('b', {}, 'Xì Trum (The Smurfs) và Gargamel'), ' © Peyo / IMPS. Hình tượng nhân vật được vẽ lại theo phong cách Peyo cho mục đích học tập, phi thương mại.'),
      h('p', {}, h('b', {}, 'Nhạc nền & jingle'), ': trích từ game ', h('i', {}, 'Smurfs Epic Run'), ' © Ubisoft.'),
      h('p', {}, h('b', {}, 'Hiệu ứng âm thanh'), ' (bước chạy, vấp ngã, "phụp" vào túi, bật ra, tiếng cười…) tổng hợp bằng WebAudio trong trình duyệt.'),
      h('p', {}, h('b', {}, 'Phông chữ'), ': Baloo 2 (Ek Type) và Be Vietnam Pro — SIL Open Font License, nhúng cục bộ.'),
      h('p', {}, h('b', {}, 'Toà nhà chính Trường Đại học Sài Gòn'), ' vẽ lại theo phong cách làng xì trum.'),
      h('p', { class: 'hint' }, 'Xem đầy đủ trong CREDITS.md. Dự án nội bộ của Trường Đại học Sài Gòn, không dùng cho mục đích thương mại.'),
    ),
  );
}

async function main() {
  const app = new App();
  if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = app; // công cụ debug khi phát triển
  app.save();
  audio.setEnabled(app.settings.sound);
  app.syncToolbar();
  app.bindKeys();
  document.getElementById('mute-btn')!.addEventListener('click', () => {
    audio.unlock();
    app.toggleMute();
  });
  document.getElementById('fs-btn')!.addEventListener('click', toggleFullscreen);
  document.getElementById('skip-btn')!.addEventListener('click', () => app.skip());
  document.getElementById('credits-link')!.addEventListener('click', (e) => {
    e.preventDefault();
    showCredits();
  });
  document.addEventListener('fullscreenchange', () => app.game.refresh());

  await loadFonts();
  const params = new URLSearchParams(location.search);
  if (params.has('gallery')) {
    const { renderGallery } = await import('./ui/gallery');
    document.getElementById('screen')!.style.overflow = 'auto';
    await renderGallery(document.getElementById('screen')!, params.get('gallery') ?? '');
    return;
  }
  try {
    audio.setManifest(await loadManifest());
  } catch {
    /* chạy không có âm thanh */
  }
  await app.showSetup();
  // khởi tạo Phaser + sinh texture trong nền để lúc bấm "Xuất kích" không phải chờ
  setTimeout(() => void app.game.init(), 300);
}

void main();
