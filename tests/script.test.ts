import { describe, expect, it } from 'vitest';
import { ChaChaRng, randomSeedHex } from '../src/shared/rng';
import {
  DURATION_MAX_MS,
  DURATION_MIN_MS,
  eligiblePool,
  generateScript,
  maxEscapesFor,
  verifyScript,
} from '../src/shared/script';
import type { DrawScript, DurationSetting } from '../src/shared/types';

const range = (n: number, from = 1) => Array.from({ length: n }, (_, i) => i + from);

function gen(poolIds: number[], n: number, escapeProb: number, duration: DurationSetting = { mode: 'random' }) {
  return generateScript({ seed: randomSeedHex(), poolIds, n, escapeProb, duration });
}

/** Giá trị tới hạn chi-square ở mức ý nghĩa 0.001. */
const CHI2_CRIT_001: Record<number, number> = { 9: 27.877, 19: 43.82 };

function chiSquare(observed: number[], expected: number): number {
  return observed.reduce((acc, o) => acc + (o - expected) ** 2 / expected, 0);
}

function checkInvariants(s: DrawScript) {
  const catches = s.events.filter((e) => e.type === 'CATCH');
  const escapes = s.events.filter((e) => e.type === 'ESCAPE');
  // đúng N người, không trùng, thuộc pool
  expect(s.result).toHaveLength(s.n);
  expect(new Set(s.result).size).toBe(s.n);
  for (const id of s.result) expect(s.poolIds).toContain(id);
  // thời lượng
  expect(s.durationMs).toBeGreaterThanOrEqual(DURATION_MIN_MS);
  expect(s.durationMs).toBeLessThanOrEqual(DURATION_MAX_MS);
  // sự kiện được sắp xếp theo thời gian
  for (let i = 1; i < s.events.length; i++) expect(s.events[i].t).toBeGreaterThanOrEqual(s.events[i - 1].t);
  // số lần chộp = N + số lần thoát; giới hạn số lần thoát
  expect(catches.length).toBe(s.n + escapes.length);
  expect(escapes.length).toBeLessThanOrEqual(maxEscapesFor(s.n));
  // lần bắt cuối nằm trong 3–6 giây cuối và là lần bắt hẳn
  const lastCatch = catches[catches.length - 1];
  expect(s.durationMs - lastCatch.t).toBeGreaterThanOrEqual(3000);
  expect(s.durationMs - lastCatch.t).toBeLessThanOrEqual(6000);
  if (lastCatch.type === 'CATCH') expect(lastCatch.escapes).toBe(false);
  // lần bắt đầu tiên sau 15–25% thời lượng (trừ khi chỉ có 1 lần chộp → đặt ở cao trào)
  if (catches.length > 1) {
    expect(catches[0].t).toBeGreaterThanOrEqual(Math.floor(s.durationMs * 0.15));
    expect(catches[0].t).toBeLessThanOrEqual(Math.ceil(s.durationMs * 0.25));
  }
  // mỗi ESCAPE nằm giữa lần chộp của chính SV đó và lần chộp kế tiếp
  for (const e of escapes) {
    if (e.type !== 'ESCAPE') continue;
    const c = catches[e.attempt];
    const next = catches[e.attempt + 1];
    expect(c.type === 'CATCH' && c.studentId).toBe(e.studentId);
    expect(e.t).toBeGreaterThan(c.t);
    expect(e.t).toBeLessThan(next.t);
  }
  // kết quả = các lần chộp không thoát, theo thứ tự
  expect(catches.filter((c) => c.type === 'CATCH' && !c.escapes).map((c) => c.type === 'CATCH' && c.studentId)).toEqual(
    s.result,
  );
}

describe('ChaCha20 RNG', () => {
  it('khớp test vector ChaCha20 gốc (key = 0, nonce = 0)', () => {
    const rng = new ChaChaRng('0'.repeat(64), 0);
    expect([rng.nextU32(), rng.nextU32(), rng.nextU32(), rng.nextU32()]).toEqual([
      0xade0b876, 0x903df1a0, 0xe56a5d40, 0x28bd8653,
    ]);
  });

  it('xác định theo seed và luồng', () => {
    const seed = randomSeedHex();
    const a = new ChaChaRng(seed, 0);
    const b = new ChaChaRng(seed, 0);
    const c = new ChaChaRng(seed, 1);
    const xs = range(50).map(() => a.nextU32());
    expect(range(50).map(() => b.nextU32())).toEqual(xs);
    expect(range(50).map(() => c.nextU32())).not.toEqual(xs);
  });

  it('int(n) luôn trong [0, n)', () => {
    const rng = new ChaChaRng(randomSeedHex());
    for (let i = 0; i < 20000; i++) {
      const n = 1 + (i % 97);
      const v = rng.int(n);
      expect(v >= 0 && v < n).toBe(true);
    }
  });
});

describe('Thuật toán gọi tên', () => {
  it('luôn ra đúng N người khác nhau, đúng mọi ràng buộc thời gian', () => {
    const rng = new ChaChaRng(randomSeedHex());
    for (let i = 0; i < 3000; i++) {
      const size = 1 + rng.int(60);
      const n = 1 + rng.int(size);
      const p = rng.float() * 0.5;
      const duration: DurationSetting =
        rng.float() < 0.5 ? { mode: 'random' } : { mode: 'fixed', ms: 30000 + rng.int(30001) };
      checkInvariants(gen(range(size, 100), n, p, duration));
    }
  });

  it('cùng seed + cùng đầu vào → cùng kịch bản (replay / kiểm chứng)', () => {
    const seed = randomSeedHex();
    const input = { seed, poolIds: range(40), n: 5, escapeProb: 0.3, duration: { mode: 'random' as const } };
    const a = generateScript(input);
    const b = generateScript({ ...input, poolIds: [...input.poolIds].reverse() });
    expect(b).toEqual(a);
    expect(verifyScript(a, { mode: 'random' })).toBe(true);
    const tampered = { ...a, result: [...a.result].reverse() };
    expect(verifyScript(tampered, { mode: 'random' })).toBe(a.result.length < 2);
    expect(verifyScript({ ...a, seed: randomSeedHex() }, { mode: 'random' })).toBe(false);
  });

  it('tôn trọng tuỳ chọn loại trừ người đã được gọi', () => {
    const all = range(30);
    const called = [3, 7, 8, 15, 22, 29];
    const pool = eligiblePool(all, called, true);
    expect(pool).toHaveLength(24);
    for (let i = 0; i < 2000; i++) {
      const s = gen(pool, 1 + (i % 24), 0.3);
      for (const id of s.result) expect(called).not.toContain(id);
      for (const e of s.events) if (e.type !== 'MISS') expect(called).not.toContain(e.studentId);
    }
    expect(eligiblePool(all, called, false)).toHaveLength(30);
  });

  it('báo lỗi khi N lớn hơn số SV khả dụng hoặc tham số sai', () => {
    expect(() => gen(range(3), 4, 0.2)).toThrow();
    expect(() => gen(range(3), 0, 0.2)).toThrow();
    expect(() => gen(range(3), 2, 0.6)).toThrow();
    expect(() => gen([1, 1, 2], 2, 0.2)).toThrow();
  });

  it('N = 5, p = 30%: luôn có ít nhất 1 pha thoát túi và thời lượng 30–60s', () => {
    for (let i = 0; i < 2000; i++) {
      const s = gen(range(40), 5, 0.3);
      expect(s.events.some((e) => e.type === 'ESCAPE')).toBe(true);
      expect(s.result).toHaveLength(5);
      expect(s.durationMs).toBeGreaterThanOrEqual(30000);
      expect(s.durationMs).toBeLessThanOrEqual(60000);
    }
  });

  it('p = 0 thì không có pha thoát túi', () => {
    for (let i = 0; i < 500; i++) {
      expect(gen(range(20), 4, 0).events.some((e) => e.type === 'ESCAPE')).toBe(false);
    }
  });

  it('phân phối đều theo từng SV qua 100k lần mô phỏng (chi-square)', () => {
    const size = 10;
    const n = 3;
    const sims = 100_000;
    const counts = new Array(size).fill(0);
    for (let i = 0; i < sims; i++) {
      for (const id of gen(range(size, 0), n, 0.3).result) counts[id]++;
    }
    const chi = chiSquare(counts, (sims * n) / size);
    expect(chi).toBeLessThan(CHI2_CRIT_001[9]);
  });

  it('mọi tập con N phần tử đồng khả năng qua 100k lần mô phỏng (chi-square)', () => {
    const size = 6;
    const n = 3;
    const sims = 100_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < sims; i++) {
      const key = gen(range(size, 0), n, 0.5, { mode: 'fixed', ms: 45000 })
        .result.slice()
        .sort((a, b) => a - b)
        .join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(20); // C(6,3)
    const chi = chiSquare([...counts.values()], sims / 20);
    expect(chi).toBeLessThan(CHI2_CRIT_001[19]);
  });
});
