import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { DB } from './db';
import { Repo } from './repo';
import { parseText } from '../shared/roster';
import { DURATION_MAX_MS, DURATION_MIN_MS, ESCAPE_PROB_MAX, eligiblePool, generateScript } from '../shared/script';
import type { DrawParams } from '../shared/types';

export interface AppOptions {
  db: DB;
  adminPassword?: string;
  staticDir?: string;
  logger?: boolean;
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

const rowSchema = z.object({
  mssv: z.string().max(40).default(''),
  fullName: z.string().min(1).max(120),
  classCode: z.string().max(40).default(''),
});

const importSchema = z
  .object({
    rows: z.array(rowSchema).max(2000).optional(),
    text: z.string().max(200_000).optional(),
    mode: z.enum(['append', 'replace']).default('append'),
  })
  .refine((v) => v.rows || v.text, { message: 'Cần "rows" hoặc "text"' });

const createClassSchema = z.object({
  name: z.string().trim().min(1, 'Tên lớp không được trống').max(120),
  rows: z.array(rowSchema).max(2000).optional(),
  text: z.string().max(200_000).optional(),
});

const durationSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('random') }),
  z.object({ mode: z.literal('fixed'), ms: z.number().int().min(DURATION_MIN_MS).max(DURATION_MAX_MS) }),
]);

const drawSchema = z.object({
  classId: z.number().int().positive(),
  n: z.number().int().min(1).max(2000),
  escapeProb: z.number().min(0).max(ESCAPE_PROB_MAX),
  duration: durationSchema,
  excludeCalled: z.boolean().default(true),
});

const listDrawsSchema = z.object({
  classId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HttpError(400, msg);
  }
  return r.data;
}

export function buildApp(opts: AppOptions): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  const repo = new Repo(opts.db);
  const password = opts.adminPassword?.trim() || '';

  const requireAdmin = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!password) return;
    const given = String(req.headers['x-admin-password'] ?? '');
    const a = Buffer.from(given);
    const b = Buffer.from(password);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return reply.code(401).send({ error: 'Cần mật khẩu giảng viên' });
    }
  };
  const write = { preHandler: requireAdmin };

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const code = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500);
    if (code >= 500) app.log.error(err);
    reply.code(code).send({ error: code >= 500 ? 'Lỗi máy chủ' : err.message });
  });

  // ---- API ----
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/auth', async () => ({ required: Boolean(password) }));
  app.post('/api/auth/check', write, async () => ({ ok: true }));

  app.get('/api/classes', async () => repo.listClasses());

  app.post('/api/classes', write, async (req, reply) => {
    const body = parse(createClassSchema, req.body);
    const cls = repo.createClass(body.name);
    const rows = body.rows ?? (body.text ? parseText(body.text) : []);
    if (rows.length) repo.importRows(cls.id, rows, 'append');
    reply.code(201);
    return repo.getClass(cls.id);
  });

  app.delete('/api/classes/:id', write, async (req) => {
    const { id } = parse(idParam, req.params);
    if (!repo.deleteClass(id)) throw new HttpError(404, 'Không tìm thấy lớp');
    return { ok: true };
  });

  app.post('/api/classes/:id/import', write, async (req) => {
    const { id } = parse(idParam, req.params);
    if (!repo.getClass(id)) throw new HttpError(404, 'Không tìm thấy lớp');
    const body = parse(importSchema, req.body);
    const rows = body.rows ?? parseText(body.text ?? '');
    if (rows.length === 0) throw new HttpError(400, 'Không đọc được sinh viên nào từ dữ liệu nhập');
    return repo.importRows(id, rows, body.mode);
  });

  app.post('/api/classes/:id/session/reset', write, async (req) => {
    const { id } = parse(idParam, req.params);
    const cls = repo.resetSession(id);
    if (!cls) throw new HttpError(404, 'Không tìm thấy lớp');
    return cls;
  });

  app.get('/api/classes/:id/students', async (req) => {
    const { id } = parse(idParam, req.params);
    const cls = repo.getClass(id);
    if (!cls) throw new HttpError(404, 'Không tìm thấy lớp');
    return { class: cls, students: repo.students(id), calledIds: repo.calledIds(id) };
  });

  /**
   * Tạo một lượt gọi tên: server sinh seed bằng crypto, chạy thuật toán, lưu seed + kịch bản + kết quả
   * rồi trả về để client chỉ việc "diễn" lại kịch bản.
   */
  app.post('/api/draws', write, async (req, reply) => {
    const body = parse(drawSchema, req.body);
    if (!repo.getClass(body.classId)) throw new HttpError(404, 'Không tìm thấy lớp');
    const all = repo.students(body.classId).map((s) => s.id);
    const pool = eligiblePool(all, repo.calledIds(body.classId), body.excludeCalled);
    if (pool.length === 0) throw new HttpError(400, 'Không còn SV khả dụng — hãy bấm "Gọi lại từ đầu"');
    if (body.n > pool.length) throw new HttpError(400, `Chỉ còn ${pool.length} SV khả dụng`);
    const params: DrawParams = {
      n: body.n,
      escapeProb: body.escapeProb,
      duration: body.duration,
      excludeCalled: body.excludeCalled,
    };
    const seed = randomBytes(32).toString('hex');
    const script = generateScript({ seed, poolIds: pool, n: body.n, escapeProb: body.escapeProb, duration: body.duration });
    const roster = repo.rosterSnapshot(body.classId, pool);
    reply.code(201);
    return repo.saveDraw(body.classId, params, script, roster);
  });

  app.get('/api/draws', async (req) => {
    const q = parse(listDrawsSchema, req.query);
    return repo.listDraws(q.classId ?? null, q.limit);
  });

  app.get('/api/draws/:id', async (req) => {
    const { id } = parse(idParam, req.params);
    const d = repo.getDraw(id);
    if (!d) throw new HttpError(404, 'Không tìm thấy lượt gọi');
    return d;
  });

  // ---- Frontend tĩnh (bản build) ----
  if (opts.staticDir && fs.existsSync(path.join(opts.staticDir, 'index.html'))) {
    const staticDir = opts.staticDir;
    app.register(fastifyStatic, { root: staticDir, prefix: '/', maxAge: '1h' });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return reply.type('text/html').sendFile('index.html', staticDir);
      }
      reply.code(404).send({ error: 'Không tìm thấy' });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => {
      reply.code(404).send({ error: 'Không tìm thấy' });
    });
  }

  return app;
}
