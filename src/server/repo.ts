// Truy cập dữ liệu (SQLite) — lớp, sinh viên, lịch sử gọi tên.
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

/** "Buổi học" bắt đầu từ lần bấm "Gọi lại từ đầu" gần nhất, và tự sang buổi mới mỗi ngày. */
function effectiveSessionStart(sessionStartedAt: string): string {
  const d = new Date();
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  return sessionStartedAt > startOfToday ? sessionStartedAt : startOfToday;
}

interface ClassRow {
  id: number;
  name: string;
  created_at: string;
  session_started_at: string;
}

export class Repo {
  constructor(private readonly db: DB) {}

  seedIfEmpty(): boolean {
    const { c } = this.db.prepare('SELECT COUNT(*) AS c FROM classes').get() as { c: number };
    if (c > 0) return false;
    const cls = this.createClass(SAMPLE_CLASS_NAME);
    this.importRows(cls.id, sampleRoster(), 'append');
    return true;
  }

  listClasses(): ClassInfo[] {
    const rows = this.db.prepare('SELECT * FROM classes ORDER BY id').all() as ClassRow[];
    return rows.map((r) => this.toClassInfo(r));
  }

  getClass(id: number): ClassInfo | null {
    const r = this.db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRow | undefined;
    return r ? this.toClassInfo(r) : null;
  }

  private toClassInfo(r: ClassRow): ClassInfo {
    const { c } = this.db.prepare('SELECT COUNT(*) AS c FROM students WHERE class_id = ?').get(r.id) as {
      c: number;
    };
    return {
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      sessionStartedAt: effectiveSessionStart(r.session_started_at),
      studentCount: c,
      calledInSession: this.calledIds(r.id).length,
    };
  }

  createClass(name: string): ClassInfo {
    const t = nowIso();
    const info = this.db
      .prepare('INSERT INTO classes (name, created_at, session_started_at) VALUES (?, ?, ?)')
      .run(name.trim(), t, t);
    return this.getClass(Number(info.lastInsertRowid))!;
  }

  deleteClass(id: number): boolean {
    return this.db.prepare('DELETE FROM classes WHERE id = ?').run(id).changes > 0;
  }

  resetSession(id: number): ClassInfo | null {
    this.db.prepare('UPDATE classes SET session_started_at = ? WHERE id = ?').run(nowIso(), id);
    return this.getClass(id);
  }

  students(classId: number): Student[] {
    return (
      this.db
        .prepare('SELECT id, class_id, mssv, full_name, class_code FROM students WHERE class_id = ? ORDER BY id')
        .all(classId) as { id: number; class_id: number; mssv: string; full_name: string; class_code: string }[]
    ).map((r) => ({ id: r.id, classId: r.class_id, mssv: r.mssv, fullName: r.full_name, classCode: r.class_code }));
  }

  /** Id các SV đã bị gọi trong buổi hiện tại của lớp. */
  calledIds(classId: number): number[] {
    const cls = this.db.prepare('SELECT session_started_at FROM classes WHERE id = ?').get(classId) as
      | { session_started_at: string }
      | undefined;
    if (!cls) return [];
    const since = effectiveSessionStart(cls.session_started_at);
    const rows = this.db
      .prepare(
        `SELECT DISTINCT r.student_id AS id FROM draw_results r
         JOIN draws d ON d.id = r.draw_id
         WHERE d.class_id = ? AND d.created_at >= ?`,
      )
      .all(classId, since) as { id: number }[];
    return rows.map((r) => r.id);
  }

  importRows(classId: number, rows: RosterRow[], mode: 'append' | 'replace') {
    const clean = finalizeRows(rows);
    let inserted = 0;
    let updated = 0;
    this.db.transaction(() => {
      if (mode === 'replace') this.db.prepare('DELETE FROM students WHERE class_id = ?').run(classId);
      const find = this.db.prepare('SELECT id FROM students WHERE class_id = ? AND mssv = ?');
      const ins = this.db.prepare(
        'INSERT INTO students (class_id, mssv, full_name, class_code, created_at) VALUES (?, ?, ?, ?, ?)',
      );
      const upd = this.db.prepare('UPDATE students SET full_name = ?, class_code = ? WHERE id = ?');
      const t = nowIso();
      for (const r of clean) {
        const ex = find.get(classId, r.mssv) as { id: number } | undefined;
        if (ex) {
          upd.run(r.fullName, r.classCode, ex.id);
          updated++;
        } else {
          ins.run(classId, r.mssv, r.fullName, r.classCode, t);
          inserted++;
        }
      }
    })();
    const total = this.students(classId).length;
    return { inserted, updated, total };
  }

  /** Ảnh chụp roster (kèm nhãn tên gọi tính trên toàn lớp) cho các id cho trước. */
  rosterSnapshot(classId: number, ids: number[]): RosterEntry[] {
    const all = this.students(classId);
    const labels = computeLabels(all);
    const byId = new Map(all.map((s) => [s.id, s]));
    return ids.map((id) => {
      const s = byId.get(id)!;
      return { id, mssv: s.mssv, fullName: s.fullName, label: labels.get(id) ?? s.fullName };
    });
  }

  saveDraw(classId: number, params: DrawParams, script: DrawScript, roster: RosterEntry[]): DrawRecord {
    const t = nowIso();
    const escapes = script.events.filter((e) => e.type === 'ESCAPE').length;
    const id = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO draws (class_id, created_at, seed, n, escape_prob, duration_ms, escapes, params_json, script_json, roster_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
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
        );
      const drawId = Number(info.lastInsertRowid);
      const ins = this.db.prepare('INSERT INTO draw_results (draw_id, position, student_id) VALUES (?, ?, ?)');
      script.result.forEach((sid, i) => ins.run(drawId, i + 1, sid));
      return drawId;
    })();
    return this.getDraw(id)!;
  }

  getDraw(id: number): DrawRecord | null {
    const r = this.db
      .prepare('SELECT d.*, c.name AS class_name FROM draws d JOIN classes c ON c.id = d.class_id WHERE d.id = ?')
      .get(id) as
      | {
          id: number;
          class_id: number;
          class_name: string;
          created_at: string;
          params_json: string;
          script_json: string;
          roster_json: string;
        }
      | undefined;
    if (!r) return null;
    return {
      id: r.id,
      classId: r.class_id,
      className: r.class_name,
      createdAt: r.created_at,
      params: JSON.parse(r.params_json),
      script: JSON.parse(r.script_json),
      roster: JSON.parse(r.roster_json),
    };
  }

  listDraws(classId: number | null, limit: number): DrawSummary[] {
    const rows = (
      classId
        ? this.db.prepare('SELECT * FROM draws WHERE class_id = ? ORDER BY id DESC LIMIT ?').all(classId, limit)
        : this.db.prepare('SELECT * FROM draws ORDER BY id DESC LIMIT ?').all(limit)
    ) as {
      id: number;
      class_id: number;
      created_at: string;
      seed: string;
      n: number;
      escape_prob: number;
      duration_ms: number;
      escapes: number;
      script_json: string;
      roster_json: string;
    }[];
    return rows.map((r) => {
      const script = JSON.parse(r.script_json) as DrawScript;
      const roster = new Map((JSON.parse(r.roster_json) as RosterEntry[]).map((e) => [e.id, e]));
      return {
        id: r.id,
        classId: r.class_id,
        createdAt: r.created_at,
        n: r.n,
        escapeProb: r.escape_prob,
        durationMs: r.duration_ms,
        escapes: r.escapes,
        seed: r.seed,
        results: script.result.map((sid) => roster.get(sid)!).filter(Boolean),
      };
    });
  }
}
