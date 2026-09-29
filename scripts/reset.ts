import fs from 'node:fs';
import path from 'node:path';

/**
 * DB 파일을 지운다. 풀이 이력까지 전부 사라지므로 CONFIRM=yes 를 요구한다.
 *   CONFIRM=yes npm run db:reset
 */
if (process.env.CONFIRM !== 'yes') {
  console.error('풀이 이력까지 모두 삭제됩니다. 실행하려면: CONFIRM=yes npm run db:reset');
  process.exit(1);
}

const dbPath = path.resolve(process.env.DATABASE_PATH ?? './data/app.db');
for (const suffix of ['', '-wal', '-shm']) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) {
    fs.rmSync(f);
    console.log(`삭제: ${f}`);
  }
}
console.log('이제 `npm run db:migrate && npm run questions:import` 로 다시 만드세요.');
