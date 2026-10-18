// Trang xem nhanh asset: mở /?gallery (lọc: /?gallery=kid).
// Hiển thị asset thật trong public/assets theo manifest; mục nào chưa có file thì hiện bản thủ tục (fallback).
import { ASSET_BASE, cachedManifest, loadManifest } from '../game/assets';
import { generateSmurfAnims, drawHat, SMURF_ACCESSORIES } from '../game/art/smurfArt';
import { generateGargamelAnims } from '../game/art/gargamelArt';
import { generateBag } from '../game/art/bagArt';
import * as P from '../game/art/propsArt';
import { h } from './dom';

function card(title: string, node: HTMLElement, note = '') {
  return h(
    'div',
    { style: 'margin-bottom:18px' },
    h('h3', { style: 'margin:4px 0' }, title, note ? h('small', { style: 'font-weight:400;opacity:.7;margin-left:8px' }, note) : null),
    node,
  );
}

function img(src: string) {
  return h('img', { src, style: 'max-width:100%;background:rgba(255,255,255,.35);outline:1px dashed #0003' });
}

export async function renderGallery(root: HTMLElement, filter: string) {
  const m = cachedManifest() ?? (await loadManifest());
  const out: HTMLElement[] = [];
  const pass = (k: string) => !filter || k.includes(filter);
  const procSmurf = generateSmurfAnims();
  const procGarg = generateGargamelAnims();
  const procBag = generateBag();

  for (const [key, s] of Object.entries(m.sprites)) {
    if (!pass(key)) continue;
    if (s.path) {
      const files = s.variants ? Object.entries(s.variants) : [['', s.path] as [string, string]];
      out.push(
        card(
          key,
          h('div', {}, ...files.map(([v, path]) => h('div', {}, v ? h('small', {}, v) : null, img(ASSET_BASE + path)))),
          `${s.frames} khung · ${s.fps} fps · ${s.path}`,
        ),
      );
    } else {
      const frames = procSmurf[key]?.frames ?? procGarg[key]?.frames ?? procBag[key];
      if (frames) out.push(card(key, h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...frames), 'fallback thủ tục'));
    }
  }
  for (const [key, s] of [...Object.entries(m.backgrounds), ...Object.entries(m.images)]) {
    if (!pass(key)) continue;
    if (s.path) out.push(card(key, img(ASSET_BASE + s.path), s.path));
  }
  if (pass('fallback')) {
    out.push(
      card(
        'fallback thủ tục: mũ, phụ kiện, chướng ngại vật, UI',
        h(
          'div',
          { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' },
          drawHat(),
          ...Object.values(SMURF_ACCESSORIES).map((a) => a.draw()),
          ...P.OBSTACLE_KINDS.map((k) => P.drawObstacle(k)),
          P.drawScroll(),
          P.drawSign(),
          P.drawBanner(180),
        ),
      ),
    );
  }
  root.style.background = '#9fd8ff';
  root.append(h('div', { style: 'padding:16px;position:relative;z-index:2' }, ...out));
}
