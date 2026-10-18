// Màn Lịch sử: các lượt đã gọi của lớp, phát lại (replay) và kiểm chứng seed.
import type { DrawSummary } from '@shared/types';
import { verifyScript } from '@shared/script';
import { api } from '../api';
import type { App } from '../app';
import { clear, fmtDate, h } from '../ui/dom';
import { openModal, toast } from '../ui/modal';

async function showVerify(id: number) {
  try {
    const d = await api.draw(id);
    const ok = verifyScript(d.script, d.params.duration);
    const roster = new Map(d.roster.map((r) => [r.id, r]));
    const name = (sid: number) => roster.get(sid)?.label ?? `#${sid}`;
    const lines = d.script.events.map((e) => {
      const t = (e.t / 1000).toFixed(2).padStart(6);
      if (e.type === 'CATCH') return `${t}s  CHỘP   ${name(e.studentId)}${e.escapes ? ' (sẽ thoát)' : ''} [${e.style}]`;
      if (e.type === 'ESCAPE') return `${t}s  THOÁT  ${name(e.studentId)}`;
      return `${t}s  HỤT    (${e.kind === 'whiff' ? 'vồ trượt' : 'Gargamel vấp'})`;
    });
    openModal(
      `🔍 Kiểm chứng lượt #${d.id}`,
      h(
        'div',
        {},
        h('p', { class: ok ? 'verify-ok' : 'verify-bad' }, ok ? '✓ Sinh lại từ seed cho ra đúng kịch bản và kết quả đã lưu.' : '✗ Không khớp — dữ liệu có thể đã bị sửa.'),
        h('p', {}, h('b', {}, 'Seed: '), h('code', { style: 'word-break:break-all' }, d.script.seed)),
        h(
          'p',
          {},
          `Pool ${d.script.poolIds.length} SV · N = ${d.script.n} · p = ${Math.round(d.script.escapeProb * 100)}% · `,
          `thời lượng ${(d.script.durationMs / 1000).toFixed(1)} s · ${d.params.excludeCalled ? 'loại trừ người đã gọi' : 'không loại trừ'}`,
        ),
        h('p', {}, h('b', {}, 'Kết quả: '), d.script.result.map((sid, i) => `${i + 1}. ${roster.get(sid)?.fullName ?? sid}`).join(' · ')),
        h('pre', { class: 'events' }, lines.join('\n')),
        h('p', { class: 'hint' }, 'Thuật toán: ChaCha20 (seed 256-bit sinh bằng crypto) → mỗi lần chộp chọn đều 1 SV trong pool; SV thoát túi được trả về pool.'),
      ),
      [],
      { wide: true },
    );
  } catch (e) {
    toast((e as Error).message, 'error');
  }
}

export async function renderHistory(app: App) {
  const root = app.screen;
  clear(root);
  const classId = app.settings.classId;
  let list: DrawSummary[] = [];
  let className = '';
  try {
    if (classId) {
      list = await api.draws(classId);
      className = (await api.classes()).find((c) => c.id === classId)?.name ?? '';
    }
  } catch (e) {
    toast((e as Error).message, 'error');
  }
  if (app.current !== 'history') return;

  const replay = async (id: number) => {
    try {
      await app.playChase(await api.draw(id), true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const viewResult = async (id: number) => {
    try {
      app.showResult(await api.draw(id), true);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const items = list.map((d) =>
    h(
      'div',
      { class: 'history-item parchment' },
      h('div', { class: 'when' }, `#${d.id}`, h('div', { class: 'hint' }, fmtDate(d.createdAt))),
      h(
        'div',
        {},
        h('div', { class: 'names' }, d.results.map((r) => `${r.label} (${r.mssv})`).join(' · ')),
        h(
          'div',
          { class: 'meta' },
          `N = ${d.n} · p = ${Math.round(d.escapeProb * 100)}% · ${(d.durationMs / 1000).toFixed(1)} s · ${d.escapes} pha thoát túi`,
        ),
      ),
      h(
        'div',
        { class: 'acts' },
        h('button', { class: 'btn primary', onclick: () => void replay(d.id) }, '▶ Phát lại'),
        h('button', { class: 'btn', onclick: () => void viewResult(d.id) }, 'Kết quả'),
        h('button', { class: 'btn', onclick: () => void showVerify(d.id) }, '🔍 Kiểm chứng'),
      ),
    ),
  );

  root.append(
    h(
      'div',
      { class: 'screen-inner' },
      h('div', { class: 'title-sign' }, h('div', { class: 'board' }, h('h1', {}, '📜 LỊCH SỬ GỌI TÊN'), h('p', {}, className))),
      h('div', { class: 'row', style: 'justify-content:center;margin-bottom:1rem' }, h('button', { class: 'btn wood', onclick: () => void app.showSetup() }, '← Về làng (cài đặt)')),
      items.length
        ? h('div', { class: 'history-list' }, ...items)
        : h('div', { class: 'parchment panel', style: 'text-align:center' }, h('h2', {}, 'Chưa có lượt gọi nào'), h('p', {}, 'Bấm "GARGAMEL XUẤT KÍCH!" để bắt đầu.')),
    ),
  );
  app.primaryAction = () => void app.showSetup();
}
