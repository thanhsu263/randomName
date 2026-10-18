// Kết nối CSDL qua libSQL: cùng một code chạy được
//  - file SQLite cục bộ (dev, Docker, test):   file:data/app.db  hoặc  :memory:
//  - Turso trên mạng (Vercel):                  libsql://<db>.turso.io  + auth token
import { createClient, type Client } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Client;

/** Các bước migration; chỉ số mảng + 1 = phiên bản schema sau khi áp dụng. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    session_started_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    mssv TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_code TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (class_id, mssv)
  );
  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE TABLE IF NOT EXISTS draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    seed TEXT NOT NULL,
    n INTEGER NOT NULL,
    escape_prob REAL NOT NULL,
    duration_ms INTEGER NOT NULL,
    escapes INTEGER NOT NULL,
    params_json TEXT NOT NULL,
    script_json TEXT NOT NULL,
    roster_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_draws_class ON draws(class_id, created_at);
  CREATE TABLE IF NOT EXISTS draw_results (
    draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    PRIMARY KEY (draw_id, position)
  );
  CREATE INDEX IF NOT EXISTS idx_draw_results_student ON draw_results(student_id);
  `,
];

export interface DbConfig {
  /** URL libSQL; mặc định file:data/app.db */
  url?: string;
  authToken?: string;
}

/** Đọc cấu hình từ biến môi trường: TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN), hoặc DB_PATH. */
export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  if (env.TURSO_DATABASE_URL) return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
  const file = env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'app.db');
  return { url: file === ':memory:' ? ':memory:' : `file:${file}` };
}

export async function openDb(cfg: DbConfig | string = {}): Promise<DB> {
  const c = typeof cfg === 'string' ? { url: cfg === ':memory:' ? ':memory:' : `file:${cfg}` } : cfg;
  const url = c.url ?? `file:${path.resolve(process.cwd(), 'data', 'app.db')}`;
  if (url.startsWith('file:')) fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
  const db = createClient({ url, authToken: c.authToken });
  await migrate(db);
  return db;
}

async function migrate(db: DB): Promise<void> {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const r = await db.execute('SELECT MAX(version) AS v FROM schema_version');
  // tương thích DB cũ (better-sqlite3) đã có bảng nhưng chưa có schema_version
  let current = Number(r.rows[0]?.v ?? 0);
  if (current === 0) {
    const t = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'classes'");
    if (t.rows.length) {
      current = 1;
      await db.execute({ sql: 'INSERT INTO schema_version (version) VALUES (?)', args: [1] });
    }
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    const stmts = MIGRATIONS[v]
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch([...stmts, { sql: 'INSERT INTO schema_version (version) VALUES (?)', args: [v + 1] }], 'write');
  }
}
