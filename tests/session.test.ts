import { describe, expect, it } from 'vitest';
import { startOfTodayVN } from '../src/server/repo';

describe('Buổi học theo giờ Việt Nam', () => {
  it('0h hôm nay theo giờ VN, không phụ thuộc múi giờ máy chủ', () => {
    // 2026-10-18 06:30 giờ VN = 2026-10-17 23:30 UTC → 0h VN ngày 18 = 17:00 UTC ngày 17
    expect(startOfTodayVN(Date.UTC(2026, 9, 17, 23, 30))).toBe('2026-10-17T17:00:00.000Z');
    // 2026-10-18 16:59 UTC = 23:59 giờ VN ngày 18 → vẫn cùng ngày
    expect(startOfTodayVN(Date.UTC(2026, 9, 18, 16, 59))).toBe('2026-10-17T17:00:00.000Z');
    // 2026-10-18 17:00 UTC = 0h giờ VN ngày 19 → sang ngày mới
    expect(startOfTodayVN(Date.UTC(2026, 9, 18, 17, 0))).toBe('2026-10-18T17:00:00.000Z');
  });
});
