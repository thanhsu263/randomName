// Cài đặt của giảng viên, lưu trong localStorage của trình duyệt (chỉ là tiện ích, không bắt buộc).
export interface Settings {
  classId: number | null;
  n: number;
  escapePct: number; // 0..50
  durationMode: 'random' | 'fixed';
  fixedSec: number; // 30..60
  excludeCalled: boolean;
  sound: boolean;
  reduceMotion: boolean;
  maxVisible: number;
  /** ẩn thanh thời gian + số giây còn lại để khán giả không đoán được lúc nào hết giờ */
  hideTimer: boolean;
}

const KEY = 'sgu-gargamel-settings-v1';

const defaults = (): Settings => ({
  classId: null,
  n: 1,
  escapePct: 5,
  durationMode: 'random',
  fixedSec: 45,
  excludeCalled: false,
  sound: true,
  reduceMotion: false,
  maxVisible: 10,
  hideTimer: true,
});

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* bỏ qua */
  }
  return defaults();
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bỏ qua */
  }
}
