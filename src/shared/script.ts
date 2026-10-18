/**
 * Thuật toán gọi tên công bằng + sinh "kịch bản sự kiện" (event script).
 *
 * Toàn bộ kịch bản được sinh TRƯỚC khi chạy hoạt cảnh, từ một seed 256-bit qua ChaCha20.
 * Thứ tự gọi RNG được cố định để cùng seed + cùng đầu vào luôn ra cùng một kịch bản
 * (replay & kiểm chứng). Mọi phép tính chỉ dùng số học cơ bản + làm tròn, không dùng hàm
 * siêu việt, nên kết quả giống hệt nhau giữa Node và trình duyệt.
 *
 * Tính công bằng: ở mỗi lần "chộp", SV được chọn đều trong pool. Quyết định "thoát túi" chỉ phụ
 * thuộc vào số thứ tự lần chộp/số lần đã thoát, KHÔNG phụ thuộc vào việc ai bị chộp; SV thoát được
 * trả lại pool. Vì vậy, có điều kiện theo lịch sử, lần bắt hẳn kế tiếp luôn đều trên pool còn lại
 * ⇒ tập kết quả cuối cùng là một tập con N phần tử ngẫu nhiên đều.
 */
import { ChaChaRng } from './rng';
import type { CatchStyle, DrawScript, DurationSetting, MissKind, ScriptEvent } from './types';

export const DURATION_MIN_MS = 30_000;
export const DURATION_MAX_MS = 60_000;
export const ESCAPE_PROB_MAX = 0.5;
/** Khoảng cách tối thiểu giữa 2 lần chộp để còn chỗ chèn pha thoát túi. */
export const ESCAPE_MIN_GAP_MS = 2_800;
export const MUSIC_TRACKS = 3;

export interface GenerateInput {
  seed: string;
  poolIds: number[];
  n: number;
  escapeProb: number;
  duration: DurationSetting;
}

export const maxEscapesFor = (n: number) => Math.ceil(n / 2) + 1;

export function clampDuration(ms: number): number {
  return Math.min(DURATION_MAX_MS, Math.max(DURATION_MIN_MS, Math.round(ms)));
}

/** Pool SV khả dụng, sắp xếp tăng dần (dạng chuẩn để kiểm chứng). */
export function eligiblePool(allIds: number[], calledIds: Iterable<number>, excludeCalled: boolean): number[] {
  const called = new Set(calledIds);
  const ids = excludeCalled ? allIds.filter((id) => !called.has(id)) : [...allIds];
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function validateInput(input: GenerateInput): void {
  const { poolIds, n, escapeProb } = input;
  if (new Set(poolIds).size !== poolIds.length) throw new Error('Danh sách SV bị trùng');
  if (!Number.isInteger(n) || n < 1) throw new Error('N phải là số nguyên ≥ 1');
  if (n > poolIds.length) throw new Error(`Chỉ còn ${poolIds.length} SV khả dụng, không thể gọi ${n} người`);
  if (!(escapeProb >= 0 && escapeProb <= ESCAPE_PROB_MAX)) throw new Error('Tỉ lệ thoát túi phải trong 0–50%');
}

interface Attempt {
  studentId: number;
  escapes: boolean;
}

export function generateScript(input: GenerateInput): DrawScript {
  validateInput(input);
  const pool = [...input.poolIds].sort((a, b) => a - b);
  const { n, escapeProb, seed } = input;
  const rng = new ChaChaRng(seed, 0);

  // 1) Thời lượng và nhạc nền
  const durationMs =
    input.duration.mode === 'random'
      ? DURATION_MIN_MS + rng.int(DURATION_MAX_MS - DURATION_MIN_MS + 1)
      : clampDuration(input.duration.ms);
  const musicIndex = rng.int(MUSIC_TRACKS);

  // 2) Mốc lần bắt đầu tiên (15–25% thời lượng) và lần bắt cuối (3–6 giây cuối)
  const first = Math.round(durationMs * (0.15 + 0.1 * rng.float()));
  const last = durationMs - (3000 + rng.int(3001));
  const windowMs = last - first;

  // 3) Chọn người — vòng lặp công bằng
  const remaining = [...pool];
  const result: number[] = [];
  const attempts: Attempt[] = [];
  const maxEsc = maxEscapesFor(n);
  let escapes = 0;
  while (result.length < n) {
    const idx = rng.int(remaining.length);
    const roll = rng.float(); // luôn rút để cấu trúc luồng RNG ổn định
    const studentId = remaining[idx];
    const totalIfEscape = n + escapes + 1; // tổng số lần chộp nếu thêm 1 lần thoát
    const timeAllows = windowMs / (totalIfEscape - 1) >= ESCAPE_MIN_GAP_MS;
    const canEscape = escapeProb > 0 && escapes < maxEsc && timeAllows;
    // Bảo đảm có ít nhất 1 pha thoát túi khi p > 0 và đủ thời gian (quy tắc chỉ dựa vào bộ đếm,
    // không dựa vào danh tính SV ⇒ không làm lệch xác suất).
    const forced = escapes === 0 && result.length === n - 1;
    const escape = canEscape && (roll < escapeProb || forced);
    attempts.push({ studentId, escapes: escape });
    if (escape) {
      escapes++;
    } else {
      remaining.splice(idx, 1);
      result.push(studentId);
    }
  }

  // 4) Mốc thời gian các lần chộp: rải đều có dao động, lần đầu ở `first`, lần cuối ở `last`
  const K = attempts.length;
  const times: number[] = [];
  if (K === 1) {
    times.push(last);
  } else {
    const gap = windowMs / (K - 1);
    for (let i = 0; i < K; i++) {
      if (i === 0) times.push(first);
      else if (i === K - 1) times.push(last);
      else times.push(Math.round(first + i * gap + (rng.float() * 0.24 - 0.12) * gap));
    }
  }

  // 5) Sự kiện CATCH / ESCAPE
  const events: ScriptEvent[] = [];
  let prevT = 0;
  attempts.forEach((a, i) => {
    const t = times[i];
    const styleRoll = rng.float();
    const room = t - prevT;
    const style: CatchStyle =
      styleRoll < 0.35 && room >= 2600 ? 'trip' : styleRoll < 0.55 && room >= 3400 ? 'feint' : 'drift';
    events.push({ type: 'CATCH', t, studentId: a.studentId, style, escapes: a.escapes, attempt: i });
    prevT = t;
    if (a.escapes) {
      const gapNext = times[i + 1] - t;
      const lo = Math.min(1300, Math.floor(gapNext * 0.45));
      const hi = Math.max(lo, gapNext - 1400);
      const te = t + Math.round(lo + (hi - lo) * (0.1 + 0.5 * rng.float()));
      events.push({ type: 'ESCAPE', t: te, studentId: a.studentId, attempt: i });
      prevT = te;
    }
  });

  // 6) Pha hụt (chỉ để tạo kịch tính): đặt vào các khoảng trống đủ dài
  const busy: [number, number][] = [[0, 3500]];
  for (const e of events) {
    if (e.type === 'CATCH') busy.push([e.t - 4200, e.t + 1800]);
    else if (e.type === 'ESCAPE') busy.push([e.t - 1300, e.t + 1800]);
  }
  busy.push([durationMs - 1500, durationMs]);
  busy.sort((x, y) => x[0] - y[0]);
  const PRE = 2800;
  const POST = 2400;
  let cursor = 0;
  for (const [a, b] of busy) {
    if (a > cursor) placeMisses(cursor, a);
    cursor = Math.max(cursor, b);
  }
  function placeMisses(a: number, b: number) {
    const len = b - a;
    if (len < PRE + POST + 600) return;
    const count = len >= 14_000 ? 2 : 1;
    const part = len / count;
    for (let k = 0; k < count; k++) {
      const pa = a + k * part;
      const usable = part - PRE - POST;
      const r1 = rng.float();
      const r2 = rng.float();
      const r3 = rng.float();
      if (usable < 600 || r1 >= 0.7) continue;
      const kind: MissKind = r2 < 0.65 ? 'whiff' : 'stumble';
      events.push({ type: 'MISS', t: Math.round(pa + PRE + usable * r3), kind });
    }
  }

  events.sort((x, y) => x.t - y.t);

  return {
    version: 1,
    seed,
    poolIds: pool,
    n,
    escapeProb,
    durationMs,
    musicIndex,
    events,
    result,
  };
}

/** Sinh lại kịch bản từ seed + đầu vào và so sánh với kịch bản đã lưu. */
export function verifyScript(script: DrawScript, duration: DurationSetting): boolean {
  try {
    const again = generateScript({
      seed: script.seed,
      poolIds: script.poolIds,
      n: script.n,
      escapeProb: script.escapeProb,
      duration,
    });
    return JSON.stringify(again) === JSON.stringify(script);
  } catch {
    return false;
  }
}

export function countEscapes(script: DrawScript): number {
  return script.events.filter((e) => e.type === 'ESCAPE').length;
}
