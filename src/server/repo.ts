// Truy cập dữ liệu (PostgreSQL: Neon hoặc PGlite) — lớp, sinh viên, lịch sử gọi tên.
// Mọi hàm đều async; thao tác ghi gộp thành ít câu lệnh nhất (1 lượt gọi mạng tới Neon nếu được).
import type { DB, Row } from './db';
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

/** Thông tin lớp kèm sĩ số và số SV đã gọi trong buổi ($1 = 0h hôm nay theo giờ VN). */
const CLASS_INFO_SQL = `
  SELECT c.id, c.name, c.created_at, c.session_started_at,
    (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count,
    (SELECT COUNT(DISTINCT r.student_id) FROM draw_results r JOIN draws d ON d.id = r.draw_id
       WHERE d.class_id = c.id AND d.created_at >= GREATEST(c.session_started_at, $1)) AS called
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
    const r = await this.db.query('SELECT COUNT(*) AS c FROM classes');
    if (num(r[0].c) > 0) return false;
    const cls = await this.createClass(SAMPLE_CLASS_NAME);
    await this.importRows(cls.id, sampleRoster(), 'append');
    return true;
  }

  async listClasses(): Promise<ClassInfo[]> {
    const rows = await this.db.query(`${CLASS_INFO_SQL} ORDER BY c.id`, [startOfTodayVN()]);
    return rows.map(toClassInfo);
  }

  async getClass(id: number): Promise<ClassInfo | null> {
    const rows = await this.db.query(`${CLASS_INFO_SQL} WHERE c.id = $2`, [startOfTodayVN(), id]);
    return rows.length ? toClassInfo(rows[0]) : null;
  }

  async createClass(name: string): Promise<ClassInfo> {
    const t = nowIso();
    const r = await this.db.query(
      'INSERT INTO classes (name, created_at, session_started_at) VALUES ($1, $2, $2) RETURNING id',
      [name.trim(), t],
    );
    return (await this.getClass(num(r[0].id)))!;
  }

  /** Xoá lớp; sinh viên và lịch sử gọi tên bị xoá theo (ON DELETE CASCADE). */
  async deleteClass(id: number): Promise<boolean> {
    const r = await this.db.query('DELETE FROM classes WHERE id = $1 RETURNING id', [id]);
    return r.length > 0;
  }

  async resetSession(id: number): Promise<ClassInfo | null> {
    await this.db.query('UPDATE classes SET session_started_at = $1 WHERE id = $2', [nowIso(), id]);
    return this.getClass(id);
  }

  async students(classId: number): Promise<Student[]> {
    const rows = await this.db.query(
      'SELECT id, class_id, mssv, full_name, class_code FROM students WHERE class_id = $1 ORDER BY id',
      [classId],
    );
    return rows.map((x) => ({
      id: num(x.id),
      classId: num(x.class_id),
      mssv: str(x.mssv),
      fullName: str(x.full_name),
      classCode: str(x.class_code),
    }));
  }

  /** Id các SV đã bị gọi trong buổi hiện tại của lớp. */
  async calledIds(classId: number): Promise<number[]> {
    const rows = await this.db.query(
      `SELECT DISTINCT r.student_id AS id FROM draw_results r
       JOIN draws d ON d.id = r.draw_id
       JOIN classes c ON c.id = d.class_id
       WHERE d.class_id = $1 AND d.created_at >= GREATEST(c.session_started_at, $2)`,
      [classId, startOfTodayVN()],
    );
    return rows.map((x) => num(x.id));
  }

  async importRows(classId: number, rows: RosterRow[], mode: 'append' | 'replace') {
    const clean = finalizeRows(rows);
    const existing = new Set<string>();
    if (mode === 'append') {
      const r = await this.db.query('SELECT mssv FROM students WHERE class_id = $1', [classId]);
      for (const x of r) existing.add(str(x.mssv));
    }
    const updated = clean.filter((r) => existing.has(r.mssv)).length;
    const inserted = clean.length - updated;
    const payload = JSON.stringify(clean.map((r) => ({ mssv: r.mssv, full_name: r.fullName, class_code: r.classCode })));
    const res = await this.db.batch([
      ...(mode === 'replace' ? [{ sql: 'DELETE FROM students WHERE class_id = $1', params: [classId] }] : []),
      {
        // thêm mới hoặc cập nhật theo MSSV, toàn bộ danh sách trong 1 câu lệnh
        sql: `INSERT INTO students (class_id, mssv, full_name, class_code, created_at)
              SELECT $1, r.mssv, r.full_name, r.class_code, $3
              FROM jsonb_to_recordset($2::jsonb) AS r(mssv TEXT, full_name TEXT, class_code TEXT)
              ON CONFLICT (class_id, mssv) DO UPDATE
                SET full_name = EXCLUDED.full_name, class_code = EXCLUDED.class_code`,
        params: [classId, payload, nowIso()],
      },
      { sql: 'SELECT COUNT(*) AS c FROM students WHERE class_id = $1', params: [classId] },
    ]);
    const total = num(res[res.length - 1][0].c);
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
    const escapes = script.events.filter((e) => e.type === 'ESCAPE').length;
    // 1 câu lệnh (nguyên tử): ghi lượt gọi + ghi kết quả theo thứ tự bị bắt
    const r = await this.db.query(
      `WITH d AS (
         INSERT INTO draws (class_id, created_at, seed, n, escape_prob, duration_ms, escapes, params_json, script_json, roster_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
       ), res AS (
         INSERT INTO draw_results (draw_id, position, student_id)
         SELECT d.id, e.ord::int, e.val::int FROM d, jsonb_array_elements_text($11::jsonb) WITH ORDINALITY AS e(val, ord)
       )
       SELECT id FROM d`,
      [
        classId,
        nowIso(),
        script.seed,
        script.n,
        script.escapeProb,
        script.durationMs,
        escapes,
        JSON.stringify(params),
        JSON.stringify(script),
        JSON.stringify(roster),
        JSON.stringify(script.result),
      ],
    );
    return (await this.getDraw(num(r[0].id)))!;
  }

  async getDraw(id: number): Promise<DrawRecord | null> {
    const rows = await this.db.query(
      'SELECT d.*, c.name AS class_name FROM draws d JOIN classes c ON c.id = d.class_id WHERE d.id = $1',
      [id],
    );
    if (!rows.length) return null;
    const x = rows[0];
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
    const rows = classId
      ? await this.db.query('SELECT * FROM draws WHERE class_id = $1 ORDER BY id DESC LIMIT $2', [classId, limit])
      : await this.db.query('SELECT * FROM draws ORDER BY id DESC LIMIT $1', [limit]);
    return rows.map((x) => {
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
