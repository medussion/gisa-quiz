import { asc, eq, inArray, sql } from 'drizzle-orm';
import { openDb } from '../src/db/raw';
import { questions as qTable } from '../src/db/schema';

/** 검증이 덜 된 문제를 모아 보여준다. 시험 직전 정리에 쓴다. */
const { sqlite, db } = openDb();

const rows = db
  .select({
    id: qTable.id,
    sourceType: qTable.sourceType,
    sourceLabel: qTable.sourceLabel,
    verificationStatus: qTable.verificationStatus,
    verificationCount: qTable.verificationCount,
    category: qTable.category,
    question: qTable.question,
  })
  .from(qTable)
  .where(inArray(qTable.verificationStatus, ['unverified', 'single_source']))
  .orderBy(asc(qTable.verificationStatus), asc(qTable.id))
  .all();

const byStatus = db
  .select({ status: qTable.verificationStatus, n: sql<number>`count(*)` })
  .from(qTable)
  .groupBy(qTable.verificationStatus)
  .all();

const bySource = db
  .select({ sourceType: qTable.sourceType, n: sql<number>`count(*)` })
  .from(qTable)
  .groupBy(qTable.sourceType)
  .all();

console.log('검증 상태별 문제 수');
for (const r of byStatus) console.log(`  ${r.status.padEnd(14)} ${r.n}`);
console.log('출처 유형별 문제 수');
for (const r of bySource) console.log(`  ${r.sourceType.padEnd(14)} ${r.n}`);

console.log(`\n검증 필요(unverified / single_source): ${rows.length}건`);
for (const r of rows.slice(0, 80)) {
  const head = r.question.replace(/\s+/g, ' ').slice(0, 56);
  console.log(`  [${r.verificationStatus}] ${r.id} (${r.category}) ${head}...`);
}
if (rows.length > 80) console.log(`  ... 외 ${rows.length - 80}건`);

const pastUnverified = db
  .select({ n: sql<number>`count(*)` })
  .from(qTable)
  .where(eq(qTable.verificationStatus, 'unverified'))
  .get();

if ((pastUnverified?.n ?? 0) > 0) {
  console.log('\n미검증 문제는 정답이 확실하지 않을 수 있습니다. 교차 출처로 확인한 뒤');
  console.log("questions.json 의 verificationStatus 를 'cross_checked' 또는 'verified' 로 올리세요.");
}

sqlite.close();
