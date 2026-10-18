// Hộp thoại tạo lớp / nhập danh sách: CSV, XLSX (SheetJS) hoặc dán văn bản mỗi dòng 1 SV.
import { parseTable, parseText } from '@shared/roster';
import type { RosterRow } from '@shared/types';
import { api } from '../api';
import { h } from '../ui/dom';
import { openModal, toast } from '../ui/modal';

async function readFile(file: File): Promise<RosterRow[]> {
  const XLSX = await import('xlsx');
  const name = file.name.toLowerCase();
  let wb;
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    const text = await file.text();
    wb = XLSX.read(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, { type: 'string', raw: true });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const table = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  return parseTable(table);
}

/**
 * @param classId null = tạo lớp mới
 * @returns Promise với id lớp đã tạo/cập nhật (hoặc null nếu huỷ)
 */
export function openImportDialog(classId: number | null, className = ''): Promise<number | null> {
  return new Promise((resolve) => {
    let rows: RosterRow[] = [];
    let done: number | null = null;
    const nameInput = h('input', {
      class: 'input',
      style: 'width:100%',
      placeholder: 'VD: Lập trình Web — Nhóm 2',
      value: className,
    });
    const fileInput = h('input', { type: 'file', accept: '.csv,.xlsx,.xls,.ods,.txt,.tsv', class: 'input', style: 'width:100%' });
    const text = h('textarea', {
      class: 'input',
      placeholder: 'Dán danh sách, mỗi dòng 1 SV. VD:\n3123410001, Nguyễn Văn An, DCT1231\n3123410002\tTrần Thị Bích Ngọc\tDCT1231\nhoặc chỉ họ tên: Lê Hoàng Nam',
    });
    const preview = h('div', { class: 'field' });
    const modeAppend = h('input', { type: 'radio', name: 'mode', value: 'append', checked: true });
    const modeReplace = h('input', { type: 'radio', name: 'mode', value: 'replace' });

    const render = () => {
      preview.replaceChildren();
      if (rows.length === 0) {
        preview.append(h('p', { class: 'hint' }, 'Chưa có dữ liệu. Cột cần có: MSSV, Họ tên, Lớp (tự nhận diện tiêu đề).'));
        return;
      }
      const table = h(
        'table',
        { class: 'preview' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'MSSV'), h('th', {}, 'Họ tên'), h('th', {}, 'Lớp'))),
        h(
          'tbody',
          {},
          ...rows.slice(0, 8).map((r, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, r.mssv), h('td', {}, r.fullName), h('td', {}, r.classCode))),
        ),
      );
      preview.append(
        h('p', {}, h('b', {}, `Đọc được ${rows.length} sinh viên`), rows.length > 8 ? ` (hiển thị 8 dòng đầu)` : ''),
        table,
      );
    };

    fileInput.addEventListener('change', async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      try {
        rows = await readFile(f);
        text.value = '';
        if (!nameInput.value) nameInput.value = f.name.replace(/\.[^.]+$/, '');
      } catch (e) {
        rows = [];
        toast(`Không đọc được file: ${(e as Error).message}`, 'error');
      }
      render();
    });
    text.addEventListener('input', () => {
      rows = parseText(text.value);
      render();
    });

    const save = h('button', { class: 'btn primary' }, classId ? 'Nhập vào lớp' : 'Tạo lớp');
    save.addEventListener('click', async () => {
      try {
        save.disabled = true;
        if (classId === null) {
          const name = nameInput.value.trim();
          if (!name) {
            toast('Hãy đặt tên lớp', 'error');
            return;
          }
          const cls = await api.createClass(name, rows.length ? rows : undefined);
          toast(`Đã tạo lớp "${cls.name}" với ${cls.studentCount} SV`, 'ok');
          done = cls.id;
        } else {
          if (rows.length === 0) {
            toast('Chưa có SV nào để nhập', 'error');
            return;
          }
          const r = await api.importRows(classId, rows, modeReplace.checked ? 'replace' : 'append');
          toast(`Đã nhập: thêm ${r.inserted}, cập nhật ${r.updated} — lớp có ${r.total} SV`, 'ok');
          done = classId;
        }
        close();
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        save.disabled = false;
      }
    });

    const body = h(
      'div',
      {},
      classId === null ? h('div', { class: 'field' }, h('label', {}, 'Tên lớp'), nameInput) : null,
      h('div', { class: 'field' }, h('label', {}, '📄 Chọn file CSV / Excel (.xlsx)'), fileInput),
      h('div', { class: 'field' }, h('label', {}, '📋 …hoặc dán danh sách'), text),
      classId !== null
        ? h(
            'div',
            { class: 'field row' },
            h('label', { class: 'toggle' }, modeAppend, 'Thêm / cập nhật theo MSSV'),
            h('label', { class: 'toggle' }, modeReplace, 'Thay toàn bộ danh sách'),
          )
        : null,
      preview,
    );
    render();
    const close = openModal(classId === null ? '➕ Tạo lớp mới' : `⬆ Nhập danh sách — ${className}`, body, [
      h('button', { class: 'btn', onclick: () => close() }, 'Huỷ'),
      save,
    ], { wide: true, onClose: () => resolve(done) });
  });
}
