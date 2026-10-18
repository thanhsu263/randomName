import type { RosterRow } from '../shared/types';

/** 40 SV giả lập (tên tiếng Việt có dấu, có vài tên trùng để minh hoạ nhãn "Tên + 2 số cuối MSSV"). */
const NAMES = [
  'Nguyễn Văn An',
  'Trần Thị Bích Ngọc',
  'Lê Hoàng Nam',
  'Phạm Minh Khôi',
  'Hoàng Thị Thu Hà',
  'Võ Quốc Bảo',
  'Đặng Thị Mỹ Duyên',
  'Bùi Đức Thịnh',
  'Đỗ Thị Hồng Nhung',
  'Huỳnh Tấn Phát',
  'Ngô Thị Thanh Trúc',
  'Dương Văn Lộc',
  'Lý Thị Kim Ngân',
  'Phan Thanh Tùng',
  'Vũ Thị Ánh Tuyết',
  'Trương Gia Huy',
  'Đinh Thị Quỳnh Như',
  'Lâm Nhật Quang',
  'Mai Thị Diễm My',
  'Cao Minh Triết',
  'Tô Thị Phương Linh',
  'Hồ Đăng Khoa',
  'Châu Thị Ngọc Hân',
  'Lưu Văn Hiếu',
  'Tạ Thị Hải Yến',
  'Nguyễn Thị Thuỳ Linh',
  'Kiều Minh Đức',
  'Quách Thị Mai Anh',
  'La Văn Phúc',
  'Tăng Thị Xuân Mai',
  'Trịnh Công Sơn',
  'Đoàn Thị Khánh Vy',
  'Âu Dương Phong',
  'Lê Thị Ngọc Ánh',
  'Phùng Văn Lực',
  'Nguyễn Hữu An',
  'Văn Thị Tường Vi',
  'Thái Bảo Ngọc',
  'Hà Quang Vinh',
  'Ông Thị Thảo Nguyên',
];

export function sampleRoster(): RosterRow[] {
  return NAMES.map((fullName, i) => ({
    mssv: `31234100${String(i + 1).padStart(2, '0')}`,
    fullName,
    classCode: i < 20 ? 'DCT1231' : 'DCT1232',
  }));
}

export const SAMPLE_CLASS_NAME = 'Lớp mẫu — Nhập môn Lập trình';
