import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb, type DB } from '../src/server/db';
import { buildApp } from '../src/server/app';
import { Repo } from '../src/server/repo';
import { verifyScript } from '../src/shared/script';
import type { ClassInfo, DrawRecord, DrawSummary } from '../src/shared/types';

let db: DB;
let app: FastifyInstance;

beforeEach(async () => {
  db = await openDb(':memory:');
  await new Repo(db).seedIfEmpty();
  app = buildApp({ db });
});
afterEach(async () => {
  await app.close();
  await db.close();
});

const drawBody = { classId: 1, n: 5, escapeProb: 0.3, duration: { mode: 'random' }, excludeCalled: true };

describe('API', () => {
  it('có lớp mẫu 40 SV', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/classes' });
    const classes = res.json() as ClassInfo[];
    expect(classes).toHaveLength(1);
    expect(classes[0].studentCount).toBe(40);
  });

  it('tạo lượt gọi, lưu vào lịch sử, kết quả khớp và kiểm chứng được', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/draws', payload: drawBody });
    expect(res.statusCode).toBe(201);
    const draw = res.json() as DrawRecord;
    expect(draw.script.result).toHaveLength(5);
    expect(new Set(draw.script.result).size).toBe(5);
    expect(verifyScript(draw.script, draw.params.duration)).toBe(true);

    const list = (await app.inject({ method: 'GET', url: '/api/draws?classId=1' })).json() as DrawSummary[];
    expect(list[0].id).toBe(draw.id);
    expect(list[0].results.map((r) => r.id)).toEqual(draw.script.result);

    const again = (await app.inject({ method: 'GET', url: `/api/draws/${draw.id}` })).json() as DrawRecord;
    expect(again.script).toEqual(draw.script);
  });

  it('không gọi lại người đã gọi trong buổi; "Gọi lại từ đầu" làm mới buổi', async () => {
    const seen = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const d = (await app.inject({ method: 'POST', url: '/api/draws', payload: drawBody })).json() as DrawRecord;
      for (const id of d.script.result) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(40);
    const full = await app.inject({ method: 'POST', url: '/api/draws', payload: drawBody });
    expect(full.statusCode).toBe(400);
    await app.inject({ method: 'POST', url: '/api/classes/1/session/reset' });
    const ok = await app.inject({ method: 'POST', url: '/api/draws', payload: drawBody });
    expect(ok.statusCode).toBe(201);
  });

  it('tạo lớp mới và import văn bản', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/classes', payload: { name: 'Lớp thử' } });
    const cls = res.json() as ClassInfo;
    const imp = await app.inject({
      method: 'POST',
      url: `/api/classes/${cls.id}/import`,
      payload: { text: 'MSSV,Họ tên,Lớp\n001,Nguyễn Văn Á,X\n002,Lê Thị Ễ,X', mode: 'append' },
    });
    expect(imp.json()).toMatchObject({ inserted: 2, total: 2 });
    const st = (await app.inject({ method: 'GET', url: `/api/classes/${cls.id}/students` })).json();
    expect(st.students.map((s: { fullName: string }) => s.fullName)).toEqual(['Nguyễn Văn Á', 'Lê Thị Ễ']);
    expect((await app.inject({ method: 'DELETE', url: `/api/classes/${cls.id}` })).statusCode).toBe(200);
  });

  it('validate dữ liệu đầu vào', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/draws', payload: { ...drawBody, escapeProb: 0.9 } });
    expect(res.statusCode).toBe(400);
    const res2 = await app.inject({ method: 'POST', url: '/api/draws', payload: { ...drawBody, n: 41 } });
    expect(res2.statusCode).toBe(400);
  });

  it('bảo vệ route ghi bằng ADMIN_PASSWORD', async () => {
    const locked = buildApp({ db, adminPassword: 'bimat' });
    expect((await locked.inject({ method: 'POST', url: '/api/draws', payload: drawBody })).statusCode).toBe(401);
    const ok = await locked.inject({
      method: 'POST',
      url: '/api/draws',
      payload: drawBody,
      headers: { 'x-admin-password': 'bimat' },
    });
    expect(ok.statusCode).toBe(201);
    expect((await locked.inject({ method: 'GET', url: '/api/classes' })).statusCode).toBe(200);
    await locked.close();
  });
});
