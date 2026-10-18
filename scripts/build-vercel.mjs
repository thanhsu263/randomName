// Đóng gói cho Vercel theo Build Output API v3 (https://vercel.com/docs/build-output-api/v3).
//   .vercel/output/static/              ← giao diện (dist/public do `vite build` tạo)
//   .vercel/output/functions/api.func/  ← 1 hàm Node chứa toàn bộ API (Fastify), đã bundle sẵn
//   .vercel/output/config.json          ← định tuyến
// Chạy: npm run build:vercel
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const OUT = '.vercel/output';
if (!existsSync('dist/public/index.html')) throw new Error('Chưa có dist/public — hãy chạy `vite build` trước');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/functions/api.func`, { recursive: true });

// 1) Tĩnh
cpSync('dist/public', `${OUT}/static`, { recursive: true });

// 2) Hàm API: bundle mọi thứ (driver Neon là JS thuần qua HTTP). PGlite chỉ dùng khi chạy cục bộ → external, không nạp trên Vercel
await build({
  entryPoints: ['src/vercel/handler.ts'],
  outfile: `${OUT}/functions/api.func/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  sourcemap: false,
  external: ['@electric-sql/pglite'],
  // các thư viện CommonJS (fastify…) cần `require` khi nằm trong bundle ESM
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
writeFileSync(
  `${OUT}/functions/api.func/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: false,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// 3) Định tuyến: /api/* → hàm; file tĩnh; còn lại trả index.html (SPA)
writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=3600' }, continue: true },
        { src: '^/api/(.*)$', dest: '/api?__p=$1' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log(`Đã tạo ${OUT} (static + functions/api.func)`);
