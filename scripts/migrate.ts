import fs from 'node:fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDb } from '../src/db/raw';

if (!fs.existsSync('drizzle')) {
  console.error('drizzle/ 폴더가 없습니다. 먼저 `npm run db:generate` 를 실행하세요.');
  process.exit(1);
}

const { sqlite, db, dbPath } = openDb();
migrate(db, { migrationsFolder: 'drizzle' });
sqlite.close();
console.log(`마이그레이션 완료: ${dbPath}`);
