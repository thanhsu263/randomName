// Màn Setup: chọn lớp, nhập danh sách, cài đặt lượt gọi, nút "GARGAMEL XUẤT KÍCH!".
import type { ClassInfo, Student } from '@shared/types';
import { computeLabels } from '@shared/roster';
import { api } from '../api';
import type { App } from '../app';
import { audio } from '../audio/AudioManager';
import { clear, h } from '../ui/dom';
import { confirmDialog, toast } from '../ui/modal';
import { kidVariants, spriteEl } from '../ui/art';
import { openImportDialog } from './importDialog';

export async function renderSetup(app: App) {
  const root = app.screen;
  clear(root);
  root.append(h('div', { class: 'loading' }, 'Đang mở làng Xì Trum…'));

  let classes: ClassInfo[] = [];
  try {
    classes = await api.classes();
  } catch (e) {
    clear(root);
    root.append(h('div', { class: 'loading' }, (e as Error).message));
    return;
  }
  const s = app.settings;
  if (!classes.some((c) => c.id === s.classId)) s.classId = classes[0]?.id ?? null;

  let students: Student[] = [];
  let called = new Set<number>();
  const load = async () => {
    if (!s.classId) {
      students = [];
      called = new Set();
      return;
    }
    const r = await api.students(s.classId);
    students = r.students;
    called = new Set(r.calledIds);
  };
  await load();
  if (app.current !== 'setup') return;

  // ---------------- dựng giao diện ----------------
  const classSelect = h('select', { class: 'input', 'aria-label': 'Chọn lớp' });
  const stats = h('div', { class: 'stats' });
  const chips = h('div', { class: 'chips', 'aria-label': 'Danh sách sinh viên' });

  const nRange = h('input', { type: 'range', min: '1', max: '1', step: '1', 'aria-label': 'Số SV cần gọi' });
  const nInput = h('input', { type: 'number', class: 'input num', min: '1', 'aria-label': 'Số SV cần gọi' });
  const nMax = h('span', { class: 'hint' });

  const durRandom = h('button', { type: 'button' }, 'Ngẫu nhiên 30–60 giây');
  const durFixed = h('button', { type: 'button' }, 'Cố định');
  const durRange = h('input', { type: 'range', min: '30', max: '60', step: '1', 'aria-label': 'Thời lượng cố định' });
  const durValue = h('span', { class: 'big-value' });
  const durRow = h('div', { class: 'row' }, durRange, durValue);

  const pRange = h('input', { type: 'range', min: '0', max: '50', step: '5', 'aria-label': 'Tỉ lệ thoát túi' });
  const pValue = h('span', { class: 'big-value' });

  const exclude = h('input', { type: 'checkbox' });
  const sound = h('input', { type: 'checkbox' });
  const reduce = h('input', { type: 'checkbox' });
  const hideTimer = h('input', { type: 'checkbox' });
  const maxVis = h('input', { type: 'number', class: 'input num', min: '6', max: '20', style: 'width:4.5rem;font-size:1.2rem' });

  const go = h('button', { class: 'go-btn' });

  const available = () => (s.excludeCalled ? students.filter((x) => !called.has(x.id)) : students);

  const refreshClassList = () => {
    clear(classSelect);
    if (classes.length === 0) classSelect.append(h('option', { value: '' }, '— Chưa có lớp nào —'));
    for (const c of classes) {
      classSelect.append(h('option', { value: String(c.id), selected: c.id === s.classId }, `${c.name} (${c.studentCount} SV)`));
    }
  };

  const update = () => {
    const avail = available().length;
    const total = students.length;
    clear(stats);
    stats.append(
      h('div', { class: 'stat' }, h('b', {}, total), h('span', {}, 'Sĩ số')),
      h('div', { class: 'stat' }, h('b', {}, called.size), h('span', {}, 'Đã gọi buổi này')),
      h('div', { class: 'stat' }, h('b', {}, avail), h('span', {}, 'Khả dụng')),
    );
    clear(chips);
    const labels = computeLabels(students);
    for (const st of students) {
      chips.append(
        h('span', { class: `chip${called.has(st.id) ? ' called' : ''}`, title: `${st.mssv} — ${st.fullName}` }, labels.get(st.id) ?? st.fullName),
      );
    }
    if (students.length === 0) chips.append(h('span', { class: 'hint' }, 'Lớp chưa có sinh viên — hãy nhập danh sách.'));

    const max = Math.max(1, avail);
    s.n = Math.min(Math.max(1, s.n), max);
    nRange.max = String(max);
    nRange.value = String(s.n);
    nInput.max = String(max);
    nInput.value = String(s.n);
    nRange.disabled = nInput.disabled = avail === 0;
    nMax.textContent = `tối đa ${avail}`;

    durRandom.classList.toggle('on', s.durationMode === 'random');
    durFixed.classList.toggle('on', s.durationMode === 'fixed');
    durRow.style.display = s.durationMode === 'fixed' ? '' : 'none';
    durRange.value = String(s.fixedSec);
    durValue.textContent = `${s.fixedSec}s`;
    pRange.value = String(s.escapePct);
    pValue.textContent = `${s.escapePct}%`;
    exclude.checked = s.excludeCalled;
    sound.checked = s.sound;
    reduce.checked = s.reduceMotion;
    hideTimer.checked = s.hideTimer;
    maxVis.value = String(s.maxVisible);

    go.disabled = avail === 0;
    clear(go);
    go.append(
      'GARGAMEL XUẤT KÍCH!',
      h('small', {}, avail === 0 ? 'Không còn SV khả dụng — bấm "Bắt đầu buổi mới"' : `Gọi ${s.n} SV · nhấn Space`),
    );
    app.save();
  };

  classSelect.addEventListener('change', async () => {
    s.classId = Number(classSelect.value) || null;
    await load();
    update();
  });
  const setN = (v: number) => {
    s.n = Math.round(v) || 1;
    update();
  };
  nRange.addEventListener('input', () => setN(Number(nRange.value)));
  nInput.addEventListener('change', () => setN(Number(nInput.value)));
  durRandom.addEventListener('click', () => ((s.durationMode = 'random'), update()));
  durFixed.addEventListener('click', () => ((s.durationMode = 'fixed'), update()));
  durRange.addEventListener('input', () => ((s.fixedSec = Number(durRange.value)), update()));
  pRange.addEventListener('input', () => ((s.escapePct = Number(pRange.value)), update()));
  exclude.addEventListener('change', () => ((s.excludeCalled = exclude.checked), update()));
  sound.addEventListener('change', () => {
    s.sound = sound.checked;
    audio.setEnabled(s.sound);
    app.syncToolbar();
    update();
  });
  reduce.addEventListener('change', () => ((s.reduceMotion = reduce.checked), update()));
  hideTimer.addEventListener('change', () => ((s.hideTimer = hideTimer.checked), update()));
  maxVis.addEventListener('change', () => {
    s.maxVisible = Math.min(20, Math.max(6, Number(maxVis.value) || 11));
    update();
  });
  go.addEventListener('click', () => void app.startDraw());

  const reloadAll = async (selectId?: number | null) => {
    classes = await api.classes();
    if (selectId) s.classId = selectId;
    if (!classes.some((c) => c.id === s.classId)) s.classId = classes[0]?.id ?? null;
    refreshClassList();
    await load();
    update();
  };

  const currentClass = () => classes.find((c) => c.id === s.classId);
  const btnNew = h('button', { class: 'btn', onclick: async () => reloadAll(await openImportDialog(null)) }, '➕ Tạo lớp mới');
  const btnImport = h(
    'button',
    {
      class: 'btn',
      onclick: async () => {
        const c = currentClass();
        if (c) await reloadAll(await openImportDialog(c.id, c.name));
      },
    },
    '⬆ Nhập danh sách',
  );
  const btnSession = h(
    'button',
    {
      class: 'btn',
      onclick: async () => {
        const c = currentClass();
        if (!c) return;
        if (await confirmDialog('Bắt đầu buổi mới', 'Mọi SV sẽ được gọi lại từ đầu (lịch sử vẫn được giữ). Tiếp tục?')) {
          await api.resetSession(c.id);
          toast('Đã bắt đầu buổi mới', 'ok');
          await reloadAll();
        }
      },
    },
    '↺ Bắt đầu buổi mới',
  );
  const btnDelete = h(
    'button',
    {
      class: 'btn danger',
      onclick: async () => {
        const c = currentClass();
        if (!c) return;
        if (await confirmDialog('Xoá lớp', `Xoá lớp "${c.name}" cùng toàn bộ SV và lịch sử gọi tên?`, 'Xoá', true)) {
          await api.deleteClass(c.id);
          toast('Đã xoá lớp', 'ok');
          s.classId = null;
          await reloadAll();
        }
      },
    },
    '🗑 Xoá lớp',
  );
  const btnHistory = h('button', { class: 'btn', onclick: () => void app.showHistory() }, '📜 Lịch sử');

  clear(root);
  root.append(
    h(
      'div',
      { class: 'screen-inner' },
      h(
        'div',
        { class: 'title-sign' },
        spriteEl('gargamel_angry', 0, 'title-art'),
        h(
          'div',
          { class: 'board' },
          h('h1', {}, 'GARGAMEL BẮT ', h('span', { class: 'blue' }, 'XÌ TRUM'), ' SGU'),
          h('p', {}, 'Làng Xì Trum phiên bản Trường Đại học Sài Gòn — gọi tên ngẫu nhiên, công bằng'),
        ),
        h('div', { class: 'title-kids' }, ...(kidVariants().length ? kidVariants().slice(0, 3) : ['']).map((v, i) => spriteEl('smurf_run', i * 3, 'title-art kid', v || undefined))),
      ),
      h(
        'div',
        { class: 'setup-grid' },
        h(
          'section',
          { class: 'parchment panel' },
          h('h2', {}, '🏫 Lớp học'),
          classSelect,
          stats,
          h('div', { class: 'row' }, btnNew, btnImport, btnSession, btnHistory, btnDelete),
          h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Đàn Xì Trum của lớp'), chips),
        ),
        h(
          'section',
          { class: 'parchment panel' },
          h('h2', {}, '⚙️ Cài đặt lượt gọi'),
          h('div', { class: 'field' }, h('label', {}, 'Số sinh viên cần gọi (N)'), h('div', { class: 'row' }, nRange, nInput, nMax)),
          h(
            'div',
            { class: 'field' },
            h('span', { class: 'field-label' }, 'Thời lượng màn rượt đuổi'),
            h('div', { class: 'row' }, h('div', { class: 'seg' }, durRandom, durFixed)),
            durRow,
          ),
          h(
            'div',
            { class: 'field' },
            h('label', {}, 'Tỉ lệ xì trum thoát khỏi túi (p)'),
            h('div', { class: 'row' }, pRange, pValue),
            h('div', { class: 'hint' }, 'Pha thoát túi chỉ tạo kịch tính — không làm lệch xác suất được gọi.'),
          ),
          h('label', { class: 'toggle' }, exclude, 'Không gọi lại người đã được gọi trong buổi này'),
          h('label', { class: 'toggle' }, sound, 'Âm thanh (phím M)'),
          h('label', { class: 'toggle' }, reduce, 'Giảm chuyển động (tắt rung, slow-motion, giảm parallax)'),
          h('label', { class: 'toggle' }, hideTimer, 'Ẩn thanh thời gian (khán giả không đoán được lúc nào hết giờ)'),
          h('label', { class: 'toggle' }, 'Số xì trum tối đa trên màn hình', maxVis),
          go,
        ),
      ),
    ),
  );
  refreshClassList();
  update();
  app.primaryAction = () => {
    if (!go.disabled) void app.startDraw();
  };
  const onSettings = () => {
    if (app.current !== 'setup') return document.removeEventListener('settings-changed', onSettings);
    sound.checked = s.sound;
  };
  document.addEventListener('settings-changed', onSettings);
}
