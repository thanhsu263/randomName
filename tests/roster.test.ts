import { describe, expect, it } from 'vitest';
import { computeLabels, givenName, parseTable, parseText } from '../src/shared/roster';

describe('Đọc danh sách sinh viên', () => {
  it('đọc bảng có tiêu đề MSSV / Họ tên / Lớp', () => {
    const rows = parseTable([
      ['STT', 'MSSV', 'Họ và tên', 'Lớp'],
      [1, 3121410001, 'nguyễn văn an', 'DCT121'],
      [2, '3121410002', 'Trần Thị Bích Ngọc', 'DCT121'],
    ]);
    expect(rows).toEqual([
      { mssv: '3121410001', fullName: 'Nguyễn Văn An', classCode: 'DCT121' },
      { mssv: '3121410002', fullName: 'Trần Thị Bích Ngọc', classCode: 'DCT121' },
    ]);
  });

  it('ghép cột "Họ lót" + "Tên"', () => {
    const rows = parseTable([
      ['Mã SV', 'Họ lót', 'Tên', 'Mã lớp'],
      ['3121410003', 'Lê Hoàng', 'Nam', 'DCT122'],
    ]);
    expect(rows[0]).toEqual({ mssv: '3121410003', fullName: 'Lê Hoàng Nam', classCode: 'DCT122' });
  });

  it('đoán cột khi không có tiêu đề', () => {
    const rows = parseTable([
      ['3121410001', 'Nguyễn Văn An', 'DCT121'],
      ['3121410002', 'Phạm Minh Khôi', 'DCT121'],
    ]);
    expect(rows[1]).toEqual({ mssv: '3121410002', fullName: 'Phạm Minh Khôi', classCode: 'DCT121' });
  });

  it('đọc văn bản dán vào (nhiều định dạng)', () => {
    const rows = parseText(
      ['3121410001, Nguyễn Văn An, DCT121', '3121410002\tTrần Thị Ngọc\tDCT121', '3121410003 Lê Hoàng Nam'].join('\n'),
    );
    expect(rows.map((r) => r.mssv)).toEqual(['3121410001', '3121410002', '3121410003']);
    expect(rows[2].fullName).toBe('Lê Hoàng Nam');
    const onlyNames = parseText('Võ Quốc Bảo\nĐặng Thị Mỹ Duyên\n');
    expect(onlyNames).toEqual([
      { mssv: 'SV001', fullName: 'Võ Quốc Bảo', classCode: '' },
      { mssv: 'SV002', fullName: 'Đặng Thị Mỹ Duyên', classCode: '' },
    ]);
  });
});

describe('Nhãn tên trên mũ', () => {
  it('lấy từ cuối làm tên gọi, thêm 2 số cuối MSSV khi trùng', () => {
    expect(givenName('  Nguyễn   Thị Thuỳ Linh ')).toBe('Linh');
    const labels = computeLabels([
      { id: 1, mssv: '3123410001', fullName: 'Nguyễn Văn An' },
      { id: 2, mssv: '3123410036', fullName: 'Nguyễn Hữu An' },
      { id: 3, mssv: '3123410005', fullName: 'Hoàng Thị Thu Hà' },
      { id: 4, mssv: '3123419901', fullName: 'Lê An' },
    ]);
    expect(labels.get(3)).toBe('Hà');
    expect(labels.get(2)).toBe('An 036');
    expect(new Set([labels.get(1), labels.get(2), labels.get(4)]).size).toBe(3);
  });

  it('2 số cuối khác nhau thì chỉ dùng 2 số', () => {
    const labels = computeLabels([
      { id: 1, mssv: '3123410001', fullName: 'Nguyễn Văn An' },
      { id: 2, mssv: '3123410036', fullName: 'Nguyễn Hữu An' },
    ]);
    expect([labels.get(1), labels.get(2)]).toEqual(['An 01', 'An 36']);
  });
});
