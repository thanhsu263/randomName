// Tạo lớp mẫu 40 SV.  Dùng: npm run seed  [-- --force]
// CSDL theo biến môi trường giống server: DATABASE_URL (Neon) hoặc PGLITE_DIR (mặc định data/pgdata).
import { dbConfigFromEnv, openDb } from '../src/server/db';
import { Repo } from '../src/server/repo';
import { sampleRoster, SAMPLE_CLASS_NAME } from '../src/server/sampleData';

const db = await openDb(dbConfigFromEnv());
const repo = new Repo(db);
if (await repo.seedIfEmpty()) {
  console.log('Đã tạo lớp mẫu 40 SV');
} else if (process.argv.includes('--force')) {
  const cls = await repo.createClass(SAMPLE_CLASS_NAME);
  const r = await repo.importRows(cls.id, sampleRoster(), 'append');
  console.log(`Đã tạo thêm lớp "${cls.name}" (id=${cls.id}) với ${r.total} SV`);
} else {
  console.log('CSDL đã có dữ liệu. Dùng "npm run seed -- --force" để tạo thêm một lớp mẫu.');
}
await db.close();
