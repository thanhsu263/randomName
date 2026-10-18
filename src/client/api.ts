// Gọi REST API của server. Nếu server bật ADMIN_PASSWORD, hỏi mật khẩu giảng viên khi cần.
import type { ClassInfo, DrawParams, DrawRecord, DrawSummary, RosterRow, Student } from '@shared/types';
import { InFlight } from './inflight';
import { beginLoading } from './ui/loading';
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

/** Yêu cầu ghi đang chờ: bấm trùng (vd. "XUẤT KÍCH" liên tục) chỉ gửi 1 lần. */
const writes = new InFlight();

function loadingMessage(method: string, url: string): string {
  if (method === 'POST' && url === '/api/draws') return 'Gargamel đang chuẩn bị túi';
  if (method === 'GET') return 'Đang tải';
  return 'Đang xử lý';
}

function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (method === 'GET') return send<T>(method, url, body);
  return writes.run(`${method} ${url} ${JSON.stringify(body ?? null)}`, () => send<T>(method, url, body));
}

async function send<T>(method: string, url: string, body?: unknown, retry = true, attempt = 0): Promise<T> {
  // yêu cầu ghi: chắn mọi thao tác trong lúc chờ; yêu cầu đọc: chỉ hiện biểu tượng chờ nếu lâu
  const end = beginLoading({ block: method !== 'GET', message: loadingMessage(method, url) });
  try {
    return await sendOnce<T>(method, url, body, retry, attempt, end);
  } finally {
    end();
  }
}

async function sendOnce<T>(
  method: string,
  url: string,
  body: unknown,
  retry: boolean,
  attempt: number,
  endLoading: () => void,
): Promise<T> {
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
  // server vừa khởi động (dev / cold start serverless): đợi chút rồi thử lại, chỉ với request đọc
  if ((res.status === 502 || res.status === 503) && method === 'GET' && attempt < 6) {
    await new Promise((r) => setTimeout(r, 700));
    return send<T>(method, url, body, retry, attempt + 1);
  }
  if (res.status === 401 && retry) {
    endLoading(); // nhả màn chắn để hộp thoại mật khẩu bấm được
    const entered = await promptPassword(pw ? 'Mật khẩu chưa đúng, nhập lại:' : 'Nhập mật khẩu giảng viên:');
    if (entered === null) throw new ApiError(401, 'Cần mật khẩu giảng viên');
    setPw(entered);
    return send<T>(method, url, body, true);
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
