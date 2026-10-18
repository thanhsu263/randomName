// Kiểu dữ liệu dùng chung giữa server và client.

export interface Student {
  id: number;
  classId: number;
  mssv: string;
  fullName: string;
  classCode: string;
}

export interface ClassInfo {
  id: number;
  name: string;
  createdAt: string;
  sessionStartedAt: string;
  studentCount: number;
  calledInSession: number;
}

/** Một dòng nhập vào từ CSV / XLSX / văn bản. */
export interface RosterRow {
  mssv: string;
  fullName: string;
  classCode: string;
}

/** Ảnh chụp thông tin SV tại thời điểm gọi tên (để replay không phụ thuộc thay đổi danh sách sau này). */
export interface RosterEntry {
  id: number;
  mssv: string;
  fullName: string;
  label: string;
}

export type DurationSetting = { mode: 'random' } | { mode: 'fixed'; ms: number };

export interface DrawParams {
  n: number;
  /** Tỉ lệ thoát túi, 0..0.5 */
  escapeProb: number;
  duration: DurationSetting;
  excludeCalled: boolean;
}

/**
 * Kiểu diễn của một lần chộp (chỉ ảnh hưởng hoạt cảnh):
 * drift = mục tiêu tụt dần về sau; trip = mục tiêu vấp chướng ngại; feint = Gargamel vồ hụt 1 lần rồi mới chộp được.
 */
export type CatchStyle = 'drift' | 'trip' | 'feint';
export type MissKind = 'whiff' | 'stumble';

export type ScriptEvent =
  | { type: 'CATCH'; t: number; studentId: number; style: CatchStyle; escapes: boolean; attempt: number }
  | { type: 'ESCAPE'; t: number; studentId: number; attempt: number }
  | { type: 'MISS'; t: number; kind: MissKind };

export interface DrawScript {
  version: 1;
  seed: string;
  /** Danh sách id SV khả dụng (đã sắp xếp tăng dần) — đầu vào của thuật toán. */
  poolIds: number[];
  n: number;
  escapeProb: number;
  durationMs: number;
  /** Chỉ số bản nhạc rượt đuổi (0..2), suy ra từ seed để replay giống hệt. */
  musicIndex: number;
  events: ScriptEvent[];
  /** Kết quả: id SV theo thứ tự bị bắt hẳn. */
  result: number[];
}

export interface DrawRecord {
  id: number;
  classId: number;
  className: string;
  createdAt: string;
  params: DrawParams;
  script: DrawScript;
  roster: RosterEntry[];
}

export interface DrawSummary {
  id: number;
  classId: number;
  createdAt: string;
  n: number;
  escapeProb: number;
  durationMs: number;
  escapes: number;
  seed: string;
  results: RosterEntry[];
}
