// Chuyển dữ liệu từ file SQLite cũ (bản dùng better-sqlite3) sang PostgreSQL (Neon hoặc PGlite).
//
//   npm run migrate:sqlite                       # data/app.db → PGlite (data/pgdata)
//   DATABASE_URL=postgres://... npm run migrate:sqlite -- data/app.db --replace   # → Neon
//
// Giữ nguyên id của lớp, sinh viên, lượt gọi (để lịch sử & replay khớp). Cần Node 22.5+ (node:sqlite).
// Nếu CSDL đích đã có dữ liệu (vd. lớp mẫu tự tạo), thêm --replace để xoá sạch trước khi chép.
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dbConfigFromEnv, openDb } from '../src/server/db';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--')) ?? 'data/app.db';
const replace = args.includes('--replace');
if (!existsSync(file)) {
  console.error(`Không tìm thấy file SQLite: ${file}`);
  process.exit(1);
}

const src = new DatabaseSync(file, { readOnly: true });
const all = (sql: string) => src.prepare(sql).all() as Record<string, unknown>[];
const classes = all('SELECT id, name, created_at, session_started_at FROM classes ORDER BY id');
const students = all('SELECT id, class_id, mssv, full_name, class_code, created_at FROM students ORDER BY id');
const draws = all(
  'SELECT id, class_id, created_at, seed, n, escape_prob, duration_ms, escapes, params_json, script_json, roster_json FROM draws ORDER BY id',
);
const results = all('SELECT draw_id, position, student_id FROM draw_results ORDER BY draw_id, position');
src.close();

const cfg = dbConfigFromEnv();
const db = await openDb(cfg);
const [{ c }] = await db.query('SELECT COUNT(*) AS c FROM classes');
if (Number(c) > 0 && !replace) {
  console.error('CSDL đích đã có dữ liệu. Chạy lại với --replace để xoá sạch rồi chép (MẤT dữ liệu hiện có ở đích).');
  await db.close();
  process.exit(1);
}

const json = (rows: unknown[]) => JSON.stringify(rows);
await db.batch([
  ...(replace ? [{ sql: 'TRUNCATE draw_results, draws, students, classes RESTART IDENTITY CASCADE' }] : []),
  {
    sql: `INSERT INTO classes (id, name, created_at, session_started_at)
          SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(id INT, name TEXT, created_at TEXT, session_started_at TEXT)`,
    params: [json(classes)],
  },
  {
    sql: `INSERT INTO students (id, class_id, mssv, full_name, class_code, created_at)
          SELECT * FROM jsonb_to_recordset($1::jsonb)
            AS r(id INT, class_id INT, mssv TEXT, full_name TEXT, class_code TEXT, created_at TEXT)`,
    params: [json(students)],
  },
  {
    sql: `INSERT INTO draws (id, class_id, created_at, seed, n, escape_prob, duration_ms, escapes, params_json, script_json, roster_json)
          SELECT * FROM jsonb_to_recordset($1::jsonb)
            AS r(id INT, class_id INT, created_at TEXT, seed TEXT, n INT, escape_prob DOUBLE PRECISION,
                 duration_ms INT, escapes INT, params_json TEXT, script_json TEXT, roster_json TEXT)`,
    params: [json(draws)],
  },
  {
    sql: `INSERT INTO draw_results (draw_id, position, student_id)
          SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(draw_id INT, position INT, student_id INT)`,
    params: [json(results)],
  },
  // đặt lại bộ đếm id để bản ghi mới không trùng id đã chép
  ...['classes', 'students', 'draws'].map((t) => ({
    sql: `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`,
  })),
]);
await db.close();
console.log(
  `Đã chép ${classes.length} lớp, ${students.length} SV, ${draws.length} lượt gọi, ${results.length} kết quả → ${cfg.kind === 'neon' ? 'Neon' : `PGlite (${cfg.dir})`}`,
);
