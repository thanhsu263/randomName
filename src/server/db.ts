import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

/** Các bước migration; chỉ số mảng + 1 = user_version sau khi áp dụng. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    session_started_at TEXT NOT NULL
  );
  CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    mssv TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_code TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (class_id, mssv)
  );
  CREATE INDEX idx_students_class ON students(class_id);
  CREATE TABLE draws (
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
  CREATE INDEX idx_draws_class ON draws(class_id, created_at);
  CREATE TABLE draw_results (
    draw_id INTEGER NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    PRIMARY KEY (draw_id, position)
  );
  CREATE INDEX idx_draw_results_student ON draw_results(student_id);
  `,
];

export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
