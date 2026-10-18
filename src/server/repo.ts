// Truy cập dữ liệu (libSQL: SQLite cục bộ hoặc Turso) — lớp, sinh viên, lịch sử gọi tên.
// Mọi hàm đều async; các thao tác nhiều câu lệnh chạy bằng batch 'write' (1 giao dịch, 1 lượt gọi mạng).
import type { InStatement, Row } from '@libsql/client';
import type { DB } from './db';
import { computeLabels, finalizeRows } from '../shared/roster';
import type {
  ClassInfo,
  DrawParams,
  DrawRecord,
  DrawScript,
  DrawSummary,
  RosterEntry,
  RosterRow,
  Student,
} from '../shared/types';
import { sampleRoster, SAMPLE_CLASS_NAME } from './sampleData';

const nowIso = () => new Date().toISOString();

/** Múi giờ của trường: Việt Nam (UTC+7, không đổi giờ mùa hè). */
const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** Thời điểm 0h hôm nay theo giờ Việt Nam (ISO, UTC) — không phụ thuộc múi giờ của máy chủ. */
export function startOfTodayVN(now = Date.now()): string {
  return new Date(Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS).toISOString();
}

/** "Buổi học" bắt đầu từ lần bấm "Gọi lại từ đầu" gần nhất, và tự sang buổi mới mỗi ngày. */
function effectiveSessionStart(sessionStartedAt: string): string {
  const startOfToday = startOfTodayVN();
  return sessionStartedAt > startOfToday ? sessionStartedAt : startOfToday;
}

const num = (v: unknown) => Number(v);
const str = (v: unknown) => String(v ?? '');

/** SQL lấy thông tin lớp kèm sĩ số và số SV đã gọi trong buổi (1 truy vấn cho mọi lớp). */
const CLASS_INFO_SQL = `
  SELECT c.id, c.name, c.created_at, c.session_started_at,
    (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count,
    (SELECT COUNT(DISTINCT r.student_id) FROM draw_results r JOIN draws d ON d.id = r.draw_id
       WHERE d.class_id = c.id AND d.created_at >= MAX(c.session_started_at, ?)) AS called
  FROM classes c`;

function toClassInfo(r: Row): ClassInfo {
  return {
    id: num(r.id),
    name: str(r.name),
    createdAt: str(r.created_at),
    sessionStartedAt: effectiveSessionStart(str(r.session_started_at)),
    studentCount: num(r.student_count),
    calledInSession: num(r.called),
  };
}

export class Repo {
  constructor(private readonly db: DB) {}

  async seedIfEmpty(): Promise<boolean> {
    const r = await this.db.execute('SELECT COUNT(*) AS c FROM classes');
    if (num(r.rows[0].c) > 0) return false;
    const cls = await this.createClass(SAMPLE_CLASS_NAME);
    await this.importRows(cls.id, sampleRoster(), 'append');
    return true;
  }

  async listClasses(): Promise<ClassInfo[]> {
    const r = await this.db.execute({ sql: `${CLASS_INFO_SQL} ORDER BY c.id`, args: [startOfTodayVN()] });
    return r.rows.map(toClassInfo);
  }

  async getClass(id: number): Promise<ClassInfo | null> {
    const r = await this.db.execute({ sql: `${CLASS_INFO_SQL} WHERE c.id = ?`, args: [startOfTodayVN(), id] });
    return r.rows.length ? toClassInfo(r.rows[0]) : null;
  }

  async createClass(name: string): Promise<ClassInfo> {
    const t = nowIso();
    const r = await this.db.execute({
      sql: 'INSERT INTO classes (name, created_at, session_started_at) VALUES (?, ?, ?)',
      args: [name.trim(), t, t],
    });
    return (await this.getClass(Number(r.lastInsertRowid)))!;
  }

  async deleteClass(id: number): Promise<boolean> {
    // xoá tường minh (không dựa vào foreign_keys/ON DELETE CASCADE, vốn tuỳ kết nối)
    const res = await this.db.batch(
      [
        { sql: 'DELETE FROM draw_results WHERE draw_id IN (SELECT id FROM draws WHERE class_id = ?)', args: [id] },
        { sql: 'DELETE FROM draws WHERE class_id = ?', args: [id] },
        { sql: 'DELETE FROM students WHERE class_id = ?', args: [id] },
        { sql: 'DELETE FROM classes WHERE id = ?', args: [id] },
      ],
      'write',
    );
    return res[3].rowsAffected > 0;
  }

  async resetSession(id: number): Promise<ClassInfo | null> {
    await this.db.execute({ sql: 'UPDATE classes SET session_started_at = ? WHERE id = ?', args: [nowIso(), id] });
    return this.getClass(id);
  }

  async students(classId: number): Promise<Student[]> {
    const r = await this.db.execute({
      sql: 'SELECT id, class_id, mssv, full_name, class_code FROM students WHERE class_id = ? ORDER BY id',
      args: [classId],
    });
    return r.rows.map((x) => ({
      id: num(x.id),
      classId: num(x.class_id),
      mssv: str(x.mssv),
      fullName: str(x.full_name),
      classCode: str(x.class_code),
    }));
  }

  /** Id các SV đã bị gọi trong buổi hiện tại của lớp. */
  async calledIds(classId: number): Promise<number[]> {
    const r = await this.db.execute({
      sql: `SELECT DISTINCT r.student_id AS id FROM draw_results r
            JOIN draws d ON d.id = r.draw_id
            JOIN classes c ON c.id = d.class_id
            WHERE d.class_id = ? AND d.created_at >= MAX(c.session_started_at, ?)`,
      args: [classId, startOfTodayVN()],
    });
    return r.rows.map((x) => num(x.id));
  }

  async importRows(classId: number, rows: RosterRow[], mode: 'append' | 'replace') {
    const clean = finalizeRows(rows);
    const existing = new Set<string>();
    if (mode === 'append') {
      const r = await this.db.execute({ sql: 'SELECT mssv FROM students WHERE class_id = ?', args: [classId] });
      for (const x of r.rows) existing.add(str(x.mssv));
    }
    const t = nowIso();
    const stmts: InStatement[] = [];
    if (mode === 'replace') stmts.push({ sql: 'DELETE FROM students WHERE class_id = ?', args: [classId] });
    let inserted = 0;
    let updated = 0;
    for (const r of clean) {
      if (existing.has(r.mssv)) updated++;
      else inserted++;
      stmts.push({
        sql: `INSERT INTO students (class_id, mssv, full_name, class_code, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (class_id, mssv) DO UPDATE SET full_name = excluded.full_name, class_code = excluded.class_code`,
        args: [classId, r.mssv, r.fullName, r.classCode, t],
      });
    }
    stmts.push({ sql: 'SELECT COUNT(*) AS c FROM students WHERE class_id = ?', args: [classId] });
    const res = await this.db.batch(stmts, 'write');
    const total = num(res[res.length - 1].rows[0].c);
    return { inserted, updated, total };
  }

  /** Ảnh chụp roster (kèm nhãn tên gọi tính trên toàn lớp) cho các id cho trước. */
  async rosterSnapshot(classId: number, ids: number[]): Promise<RosterEntry[]> {
    const all = await this.students(classId);
    const labels = computeLabels(all);
    const byId = new Map(all.map((s) => [s.id, s]));
    return ids.map((id) => {
      const s = byId.get(id)!;
      return { id, mssv: s.mssv, fullName: s.fullName, label: labels.get(id) ?? s.fullName };
    });
  }

  async saveDraw(classId: number, params: DrawParams, script: DrawScript, roster: RosterEntry[]): Promise<DrawRecord> {
    const t = nowIso();
    const escapes = script.events.filter((e) => e.type === 'ESCAPE').length;
    // 1 giao dịch: ghi lượt gọi rồi ghi kết quả (draw_id = id vừa tạo, lấy bằng MAX(id) trong cùng giao dịch)
    const res = await this.db.batch(
      [
        {
          sql: `INSERT INTO draws (class_id, created_at, seed, n, escape_prob, duration_ms, escapes, params_json, script_json, roster_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            classId,
            t,
            script.seed,
            script.n,
            script.escapeProb,
            script.durationMs,
            escapes,
            JSON.stringify(params),
            JSON.stringify(script),
            JSON.stringify(roster),
          ],
        },
        {
          sql: `INSERT INTO draw_results (draw_id, position, student_id)
                SELECT (SELECT MAX(id) FROM draws), CAST(j.key AS INTEGER) + 1, j.value FROM json_each(?) j`,
          args: [JSON.stringify(script.result)],
        },
      ],
      'write',
    );
    return (await this.getDraw(Number(res[0].lastInsertRowid)))!;
  }

  async getDraw(id: number): Promise<DrawRecord | null> {
    const r = await this.db.execute({
      sql: 'SELECT d.*, c.name AS class_name FROM draws d JOIN classes c ON c.id = d.class_id WHERE d.id = ?',
      args: [id],
    });
    if (!r.rows.length) return null;
    const x = r.rows[0];
    return {
      id: num(x.id),
      classId: num(x.class_id),
      className: str(x.class_name),
      createdAt: str(x.created_at),
      params: JSON.parse(str(x.params_json)),
      script: JSON.parse(str(x.script_json)),
      roster: JSON.parse(str(x.roster_json)),
    };
  }

  async listDraws(classId: number | null, limit: number): Promise<DrawSummary[]> {
    const r = classId
      ? await this.db.execute({ sql: 'SELECT * FROM draws WHERE class_id = ? ORDER BY id DESC LIMIT ?', args: [classId, limit] })
      : await this.db.execute({ sql: 'SELECT * FROM draws ORDER BY id DESC LIMIT ?', args: [limit] });
    return r.rows.map((x) => {
      const script = JSON.parse(str(x.script_json)) as DrawScript;
      const roster = new Map((JSON.parse(str(x.roster_json)) as RosterEntry[]).map((e) => [e.id, e]));
      return {
        id: num(x.id),
        classId: num(x.class_id),
        createdAt: str(x.created_at),
        n: num(x.n),
        escapeProb: num(x.escape_prob),
        durationMs: num(x.duration_ms),
        escapes: num(x.escapes),
        seed: str(x.seed),
        results: script.result.map((sid) => roster.get(sid)!).filter(Boolean),
      };
    });
  }
}
