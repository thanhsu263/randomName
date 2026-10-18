// Vercel Function: chạy toàn bộ REST API (Fastify) trong 1 hàm serverless.
// Được đóng gói thành .vercel/output/functions/api.func/index.mjs bởi scripts/build-vercel.mjs.
// CSDL: Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). Giao diện tĩnh do Vercel CDN phục vụ.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server/app';
import { dbConfigFromEnv, openDb } from '../server/db';
import { Repo } from '../server/repo';

let appPromise: Promise<FastifyInstance> | null = null;

/** Khởi tạo 1 lần cho mỗi instance (cold start), dùng lại ở các request sau. */
function getApp(): Promise<FastifyInstance> {
  appPromise ??= (async () => {
    if (!process.env.TURSO_DATABASE_URL) throw new Error('Thiếu biến môi trường TURSO_DATABASE_URL');
    const db = await openDb(dbConfigFromEnv());
    if (process.env.SEED_SAMPLE !== '0') await new Repo(db).seedIfEmpty();
    const app = buildApp({ db, adminPassword: process.env.ADMIN_PASSWORD });
    await app.ready();
    return app;
  })().catch((err) => {
    appPromise = null; // lần sau thử lại
    throw err;
  });
  return appPromise;
}

/** Route của Vercel chuyển /api/<path> thành /api?__p=<path>; khôi phục lại URL gốc cho Fastify. */
export function restoreUrl(url: string): string {
  const u = new URL(url, 'http://local');
  const p = u.searchParams.get('__p');
  if (p === null) return url;
  u.searchParams.delete('__p');
  const qs = u.searchParams.toString();
  return `/api/${p.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    req.url = restoreUrl(req.url ?? '/');
    app.server.emit('request', req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Máy chủ chưa cấu hình xong CSDL (xem DEPLOY.md)' }));
  }
}
