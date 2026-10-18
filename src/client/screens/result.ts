// Màn Kết quả: túi của Gargamel mở ra, lần lượt hiện thẻ tên từng SV bị bắt.
import type { DrawRecord } from '@shared/types';
import { countEscapes, verifyScript } from '@shared/script';
import { api } from '../api';
import type { App } from '../app';
import { audio } from '../audio/AudioManager';
import { frameCount, kidVariants, setSpriteFrame, spriteEl } from '../ui/art';
import { clear, h } from '../ui/dom';
import { confirmDialog, toast } from '../ui/modal';

export function renderResult(app: App, draw: DrawRecord, replay: boolean) {
  const root = app.screen;
  clear(root);
  const roster = new Map(draw.roster.map((r) => [r.id, r]));
  const people = draw.script.result.map((id) => roster.get(id)!).filter(Boolean);
  const rm = app.settings.reduceMotion;

  const bag = spriteEl('bag_wriggle', 0, 'result-bag shake', undefined, 'Túi của Gargamel');
  // túi giãy trong lúc chờ mở
  let wf = 0;
  const wriggle = setInterval(() => {
    if (!bag.isConnected) return clearInterval(wriggle);
    setSpriteFrame(bag, ++wf % frameCount('bag_wriggle'), 'bag_wriggle');
  }, 110);
  const variants = kidVariants();
  const cards = h('div', { class: `cards${people.length <= 4 ? ' few' : ''}` });
  const title = h('div', { class: 'result-title' }, 'Túi của Gargamel có…');
  const verified = verifyScript(draw.script, draw.params.duration);

  const copy = async () => {
    const text = people.map((p, i) => `${i + 1}. ${p.mssv} - ${p.fullName}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Đã sao chép danh sách', 'ok');
    } catch {
      // trình duyệt chặn clipboard (http không an toàn) → hiện để sao chép thủ công
      const ta = h('textarea', { class: 'input' }, text);
      root.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Đã sao chép danh sách', 'ok');
    }
  };
  const callNext = async () => {
    if (replay) return void app.showSetup();
    app.settings.classId = draw.classId;
    try {
      const st = await api.students(draw.classId);
      const called = new Set(st.calledIds);
      const avail = app.settings.excludeCalled ? st.students.filter((x) => !called.has(x.id)).length : st.students.length;
      if (avail === 0) {
        toast('Đã gọi hết lớp trong buổi này — bấm "Gọi lại từ đầu"', 'error');
        return;
      }
      if (app.settings.n > avail) {
        app.settings.n = avail;
        toast(`Chỉ còn ${avail} SV khả dụng — gọi ${avail} người`, 'info');
      }
      app.save();
      await app.startDraw();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const restart = async () => {
    if (!(await confirmDialog('Gọi lại từ đầu', 'Bắt đầu buổi mới: mọi SV đều có thể được gọi lại. Tiếp tục?'))) return;
    try {
      await api.resetSession(draw.classId);
      toast('Đã bắt đầu buổi mới', 'ok');
      await app.showSetup();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const actions = h(
    'div',
    { class: 'result-actions' },
    h('button', { class: 'btn', onclick: copy }, '📋 Sao chép danh sách'),
    h('button', { class: 'btn primary', onclick: callNext }, replay ? '⚙️ Về cài đặt' : '▶ Gọi tiếp', h('kbd', {}, 'Space')),
    h('button', { class: 'btn', onclick: restart }, '↺ Gọi lại từ đầu'),
    h('button', { class: 'btn', onclick: () => void app.showHistory() }, '📜 Xem lịch sử'),
    h('button', { class: 'btn', onclick: () => void app.playChase(draw, true) }, '⟲ Xem lại lượt này'),
    !replay ? h('button', { class: 'btn', onclick: () => void app.showSetup() }, '⚙️ Cài đặt') : null,
  );

  root.append(
    h(
      'div',
      { class: 'screen-inner' },
      h(
        'div',
        { class: 'result-top' },
        spriteEl('gargamel_angry', 2, 'result-garg', undefined, 'Phù thủy'),
        bag,
      ),
      title,
      cards,
      actions,
      h(
        'div',
        { class: 'seed-line' },
        `${replay ? 'Phát lại · ' : ''}Lượt #${draw.id} · ${draw.className} · ${(draw.script.durationMs / 1000).toFixed(1)} giây · `,
        `${countEscapes(draw.script)} pha thoát túi · seed ${draw.script.seed} · `,
        h('span', { class: verified ? 'verify-ok' : 'verify-bad' }, verified ? '✓ kiểm chứng khớp' : '✗ kiểm chứng KHÔNG khớp'),
      ),
    ),
  );
  app.primaryAction = () => void callNext();

  // --- hoạt cảnh mở túi (bag_open: túi buộc → mở miệng) ---
  let frame = 0;
  const startDelay = rm ? 0 : 650;
  const openN = frameCount('bag_open');
  setTimeout(() => {
    clearInterval(wriggle);
    bag.classList.remove('shake');
    const iv = setInterval(() => {
      setSpriteFrame(bag, Math.min(frame, openN - 1), 'bag_open');
      if (++frame >= openN) clearInterval(iv);
    }, rm ? 1 : 110);
  }, startDelay);

  const step = rm ? 60 : Math.max(250, Math.min(700, 3800 / Math.max(1, people.length)));
  people.forEach((p, i) => {
    setTimeout(
      () => {
        if (app.current !== 'result') return;
        const bagRect = bag.getBoundingClientRect();
        const card = h(
          'div',
          { class: 'card parchment' },
          h('div', { class: 'no' }, i + 1),
          spriteEl('smurf_escape_pop', 4, 'card-kid', variants.length ? variants[i % variants.length] : undefined),
          h(
            'div',
            { class: 'who' },
            h('div', { class: 'label' }, p.label),
            h('div', { class: 'full' }, p.fullName),
            h('div', { class: 'mssv' }, `MSSV: ${p.mssv}`),
          ),
        );
        cards.append(card);
        const r = card.getBoundingClientRect();
        card.style.setProperty('--fx', `${bagRect.left + bagRect.width / 2 - (r.left + r.width / 2)}px`);
        card.style.setProperty('--fy', `${bagRect.top + bagRect.height / 2 - (r.top + r.height / 2)}px`);
        audio.sfx('pop');
        if (i === people.length - 1) title.textContent = `Gargamel đã bắt được ${people.length} xì trum!`;
      },
      startDelay + 350 + i * step,
    );
  });
}
