// Xử lý danh sách sinh viên: đọc bảng CSV/XLSX, văn bản dán vào, và tạo nhãn tên gọi trên mũ.
import type { RosterRow } from './types';

export function normalizeSpaces(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Bỏ dấu tiếng Việt (để so khớp tiêu đề cột). */
export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Viết hoa chữ cái đầu mỗi từ (giữ nguyên dấu). */
export function titleCase(s: string): string {
  return normalizeSpaces(s)
    .toLocaleLowerCase('vi')
    .split(' ')
    .map((w) => (w ? w[0].toLocaleUpperCase('vi') + w.slice(1) : w))
    .join(' ');
}

/** Tên gọi = từ cuối của họ tên. */
export function givenName(fullName: string): string {
  const parts = normalizeSpaces(fullName).split(' ');
  return parts[parts.length - 1] || fullName;
}

/**
 * Tạo nhãn hiển thị trên mũ: tên gọi; nếu trùng tên trong lớp thì thêm 2 số cuối MSSV
 * (thêm nhiều số hơn nếu vẫn trùng).
 */
export function computeLabels(students: { id: number; mssv: string; fullName: string }[]): Map<number, string> {
  const labels = new Map<number, string>();
  const groups = new Map<string, typeof students>();
  for (const s of students) {
    const key = givenName(s.fullName).toLocaleLowerCase('vi');
    const g = groups.get(key);
    if (g) g.push(s);
    else groups.set(key, [s]);
  }
  for (const group of groups.values()) {
    if (group.length === 1) {
      labels.set(group[0].id, givenName(group[0].fullName));
      continue;
    }
    let digits = 2;
    for (;;) {
      const cand = group.map((s) => `${givenName(s.fullName)} ${s.mssv.slice(-digits)}`);
      const unique = new Set(cand).size === cand.length;
      const maxLen = Math.max(...group.map((s) => s.mssv.length));
      if (unique || digits >= maxLen) {
        group.forEach((s, i) => labels.set(s.id, unique ? cand[i] : `${givenName(s.fullName)} #${s.id}`));
        break;
      }
      digits++;
    }
  }
  return labels;
}

type ColumnRole = 'mssv' | 'fullName' | 'lastName' | 'firstName' | 'classCode' | 'stt';

function headerRole(cell: string): ColumnRole | null {
  const h = stripDiacritics(normalizeSpaces(cell)).toLowerCase();
  if (!h) return null;
  if (/^(stt|tt|no\.?|#)$/.test(h)) return 'stt';
  if (/^(mssv|msv|ma\s*so\s*(sinh\s*vien|sv)?|ma\s*(sinh\s*vien|sv)|student\s*id|id|ma\s*so)$/.test(h))
    return 'mssv';
  if (/^(ho\s*(va|&)?\s*ten|ho\s*ten|full\s*name|name|ten\s*sinh\s*vien|sinh\s*vien)$/.test(h)) return 'fullName';
  if (/^(ho|ho\s*lot|ho\s*dem|ho\s*va\s*ten\s*lot|last\s*name)$/.test(h)) return 'lastName';
  if (/^(ten|first\s*name)$/.test(h)) return 'firstName';
  if (/^(lop|ma\s*lop|class|lop\s*hoc)$/.test(h)) return 'classCode';
  return null;
}

const looksLikeId = (s: string) => /^[A-Za-z]{0,4}\d{4,}[A-Za-z0-9]*$/.test(s.trim());

/** Đọc bảng 2 chiều (từ CSV/XLSX). Tự nhận diện dòng tiêu đề; nếu không có thì đoán theo nội dung. */
export function parseTable(table: unknown[][]): RosterRow[] {
  const rows = table
    .map((r) => (Array.isArray(r) ? r.map((c) => normalizeSpaces(c == null ? '' : String(c))) : []))
    .filter((r) => r.some((c) => c !== ''));
  if (rows.length === 0) return [];

  let headerIdx = -1;
  let roles: (ColumnRole | null)[] = [];
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const r = rows[i].map(headerRole);
    const hasName = r.includes('fullName') || r.includes('firstName');
    if (hasName) {
      headerIdx = i;
      roles = r;
      break;
    }
  }

  if (headerIdx < 0) {
    // Không có tiêu đề: đoán cột MSSV (nhiều chữ số), họ tên (chuỗi dài nhất có khoảng trắng), lớp.
    const width = Math.max(...rows.map((r) => r.length));
    const score = (col: number, fn: (s: string) => boolean) =>
      rows.reduce((acc, r) => acc + (r[col] && fn(r[col]) ? 1 : 0), 0);
    roles = new Array(width).fill(null);
    let idCol = -1;
    let best = 0;
    for (let c = 0; c < width; c++) {
      const s = score(c, looksLikeId);
      if (s > best && s >= rows.length * 0.6) {
        best = s;
        idCol = c;
      }
    }
    let nameCol = -1;
    let bestLen = 0;
    for (let c = 0; c < width; c++) {
      if (c === idCol) continue;
      if (score(c, (s) => /^\d+$/.test(s)) > rows.length * 0.5) continue;
      const avg = rows.reduce((a, r) => a + (r[c]?.length ?? 0), 0) / rows.length;
      if (avg > bestLen) {
        bestLen = avg;
        nameCol = c;
      }
    }
    if (idCol >= 0) roles[idCol] = 'mssv';
    if (nameCol >= 0) roles[nameCol] = 'fullName';
    for (let c = 0; c < width; c++) {
      if (roles[c] === null && c !== idCol && c !== nameCol && score(c, (s) => s.length > 0) > rows.length * 0.5) {
        if (!roles.includes('classCode')) roles[c] = 'classCode';
      }
    }
  }

  const col = (role: ColumnRole) => roles.indexOf(role);
  const cM = col('mssv');
  const cF = col('fullName');
  const cL = col('lastName');
  const cT = col('firstName');
  const cC = col('classCode');

  const out: RosterRow[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    let name = cF >= 0 ? r[cF] ?? '' : '';
    if (!name && (cL >= 0 || cT >= 0)) name = normalizeSpaces(`${cL >= 0 ? r[cL] ?? '' : ''} ${cT >= 0 ? r[cT] ?? '' : ''}`);
    else if (name && cT >= 0 && cF !== cT && r[cT] && !name.endsWith(r[cT])) name = normalizeSpaces(`${name} ${r[cT]}`);
    if (!name || /^\d+$/.test(name)) continue;
    out.push({
      mssv: cM >= 0 ? (r[cM] ?? '').replace(/\s/g, '') : '',
      fullName: name,
      classCode: cC >= 0 ? r[cC] ?? '' : '',
    });
  }
  return finalizeRows(out);
}

/** Đọc văn bản dán vào: mỗi dòng 1 SV. Hỗ trợ "MSSV, Họ tên, Lớp", tab, ";", "|" hoặc chỉ họ tên. */
export function parseText(text: string): RosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const sep = (l: string) =>
    l.includes('\t') ? '\t' : l.includes(';') ? ';' : l.includes('|') ? '|' : l.includes(',') ? ',' : null;
  const table: string[][] = lines.map((l) => {
    const s = sep(l);
    if (s) return l.split(s).map((c) => c.trim());
    // "3121410001 Nguyễn Văn An" → tách MSSV ở đầu dòng
    const m = l.match(/^([A-Za-z]{0,4}\d{4,}[A-Za-z0-9]*)\s+(.+)$/);
    if (m) return [m[1], m[2]];
    const m2 = l.match(/^\d+[.)]\s+(.+)$/); // "1. Nguyễn Văn An"
    if (m2) return [m2[1]];
    return [l];
  });
  return parseTable(table);
}

/** Chuẩn hoá: viết hoa tên, sinh MSSV tạm cho dòng thiếu, bỏ dòng trùng MSSV. */
export function finalizeRows(rows: RosterRow[]): RosterRow[] {
  const seen = new Set<string>();
  const out: RosterRow[] = [];
  let auto = 1;
  for (const r of rows) {
    const fullName = titleCase(r.fullName);
    if (!fullName) continue;
    let mssv = normalizeSpaces(r.mssv).replace(/\s/g, '');
    if (!mssv) {
      while (seen.has(`SV${String(auto).padStart(3, '0')}`)) auto++;
      mssv = `SV${String(auto).padStart(3, '0')}`;
    }
    if (seen.has(mssv)) continue;
    seen.add(mssv);
    out.push({ mssv, fullName, classCode: normalizeSpaces(r.classCode) });
  }
  return out;
}
