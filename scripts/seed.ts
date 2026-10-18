// Tạo (hoặc tạo lại) lớp mẫu 40 SV.  Dùng: npm run seed  [-- --force]
import path from 'node:path';
import { openDb } from '../src/server/db';
import { Repo } from '../src/server/repo';
import { sampleRoster, SAMPLE_CLASS_NAME } from '../src/server/sampleData';

const dbPath = process.env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'app.db');
const db = openDb(dbPath);
const repo = new Repo(db);
if (repo.seedIfEmpty()) {
  console.log('Đã tạo lớp mẫu 40 SV');
} else if (process.argv.includes('--force')) {
  const cls = repo.createClass(SAMPLE_CLASS_NAME);
  const r = repo.importRows(cls.id, sampleRoster(), 'append');
  console.log(`Đã tạo thêm lớp "${cls.name}" (id=${cls.id}) với ${r.total} SV`);
} else {
  console.log('CSDL đã có dữ liệu. Dùng "npm run seed -- --force" để tạo thêm một lớp mẫu.');
}
db.close();
