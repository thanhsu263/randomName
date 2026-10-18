import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbConfigFromEnv, openDb } from './db';
import { buildApp } from './app';
import { Repo } from './repo';

const here = path.dirname(fileURLToPath(import.meta.url));
const portArg = process.argv.find((a) => a.startsWith('--port='));
const port = Number(portArg ? portArg.slice(7) : (process.env.PORT ?? 3000));
const host = process.env.HOST ?? '127.0.0.1';
// CSDL: Neon nếu có DATABASE_URL, ngược lại PGlite lưu ở PGLITE_DIR (mặc định data/pgdata)
const db = await openDb(dbConfigFromEnv());
if (await new Repo(db).seedIfEmpty()) console.log('[db] Đã tạo lớp mẫu 40 sinh viên');

// Bản build: dist/server.js phục vụ dist/public. Khi dev, Vite phục vụ frontend.
const app = buildApp({
  db,
  adminPassword: process.env.ADMIN_PASSWORD,
  staticDir: path.join(here, 'public'),
  logger: process.env.LOG === '1',
});

app
  .listen({ port, host })
  .then(() => {
    console.log(`🍄 Gargamel bắt Xì Trum SGU đang chạy tại http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    if (process.env.ADMIN_PASSWORD) console.log('🔒 Các thao tác ghi yêu cầu mật khẩu giảng viên (ADMIN_PASSWORD)');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

const shutdown = () => {
  app.close().finally(() => {
    void db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
