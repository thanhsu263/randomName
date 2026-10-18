// Gọi REST API của server. Nếu server bật ADMIN_PASSWORD, hỏi mật khẩu giảng viên khi cần.
import type { ClassInfo, DrawParams, DrawRecord, DrawSummary, RosterRow, Student } from '@shared/types';
import { promptPassword } from './ui/modal';

const PW_KEY = 'sgu-admin-pw';

function getPw(): string {
  try {
    return sessionStorage.getItem(PW_KEY) ?? '';
  } catch {
    return '';
  }
}

function setPw(pw: string) {
  try {
    sessionStorage.setItem(PW_KEY, pw);
  } catch {
    /* bỏ qua */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const pw = getPw();
  if (pw) headers['x-admin-password'] = pw;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Hãy kiểm tra server đang chạy.');
  }
  if (res.status === 401 && retry) {
    const entered = await promptPassword(pw ? 'Mật khẩu chưa đúng, nhập lại:' : 'Nhập mật khẩu giảng viên:');
    if (entered === null) throw new ApiError(401, 'Cần mật khẩu giảng viên');
    setPw(entered);
    return request<T>(method, url, body, true);
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Lỗi ${res.status}`);
  return data as T;
}

export const api = {
  classes: () => request<ClassInfo[]>('GET', '/api/classes'),
  createClass: (name: string, rows?: RosterRow[]) => request<ClassInfo>('POST', '/api/classes', { name, rows }),
  deleteClass: (id: number) => request<{ ok: true }>('DELETE', `/api/classes/${id}`),
  importRows: (id: number, rows: RosterRow[], mode: 'append' | 'replace') =>
    request<{ inserted: number; updated: number; total: number }>('POST', `/api/classes/${id}/import`, { rows, mode }),
  students: (id: number) =>
    request<{ class: ClassInfo; students: Student[]; calledIds: number[] }>('GET', `/api/classes/${id}/students`),
  resetSession: (id: number) => request<ClassInfo>('POST', `/api/classes/${id}/session/reset`, {}),
  createDraw: (classId: number, p: DrawParams) => request<DrawRecord>('POST', '/api/draws', { classId, ...p }),
  draws: (classId: number) => request<DrawSummary[]>('GET', `/api/draws?classId=${classId}`),
  draw: (id: number) => request<DrawRecord>('GET', `/api/draws/${id}`),
};
