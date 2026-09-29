import { sql } from 'drizzle-orm';
import { openDb } from '../src/db/raw';
import { questionProgress, questions as qTable } from '../src/db/schema';
import { normalizeForDedupe } from '../src/lib/grading';
import { validateQuestions, type RawQuestion } from '../src/lib/question-schema';
import { loadQuestionFiles, writeRejected } from './_util';

const explicit = process.argv[2];
const files = loadQuestionFiles(explicit);

if (files.length === 0) {
  console.log('data/normalized 에 JSON 파일이 없습니다. import 할 것이 없습니다.');
  process.exit(0);
}

const valid: (RawQuestion & { __file: string })[] = [];
const rejected: unknown[] = [];
let errorCount = 0;

for (const { file, data } of files) {
  const res = validateQuestions(data);
  const errors = res.issues.filter((i) => i.level === 'error');
  errorCount += errors.length;
  for (const i of errors) console.log(`ERROR ${file} [${i.id}] ${i.message}`);
  valid.push(...res.valid.map((q) => ({ ...q, __file: file })));
  rejected.push(...res.rejected);
}

if (rejected.length > 0) {
  const out = writeRejected(`rejected-import-${Date.now()}.json`, rejected);
  console.log(`거절된 ${rejected.length}건은 import 하지 않고 ${out} 에 기록했습니다.`);
}

// 파일 간 id가 겹치면 뒤에 읽은 파일이 이긴다.
const byId = new Map<string, RawQuestion & { __file: string }>();
for (const q of valid) byId.set(q.id, q);

const { sqlite, db, dbPath } = openDb();

const rows = [...byId.values()].map((q) => ({
  id: q.id,
  sourceType: q.sourceType,
  sourceLabel: q.sourceLabel ?? '',
  sourceUrls: JSON.stringify(q.sourceUrls ?? []),
  year: q.year ?? null,
  round: q.round ?? null,
  category: q.category,
  subcategory: q.subcategory ?? null,
  questionType: q.questionType,
  question: q.question,
  code: q.code ?? null,
  codeLang: q.codeLang ?? null,
  image: q.image ?? null,
  answer: JSON.stringify(q.answer),
  acceptedAnswers: JSON.stringify(q.acceptedAnswers ?? []),
  choices: q.choices ? JSON.stringify(q.choices) : null,
  hint: q.hint ?? null,
  caseSensitive: q.caseSensitive ?? false,
  orderSensitive: q.orderSensitive ?? false,
  explanation: q.explanation ?? '',
  difficulty: q.difficulty ?? 3,
  verificationStatus: q.verificationStatus ?? 'unverified',
  verificationCount: q.verificationCount ?? 0,
  basedOn: q.basedOn ?? null,
  normalizedText: normalizeForDedupe(`${q.question} ${q.code ?? ''} ${q.image ?? ''}`),
  sourceFile: q.__file,
  active: q.active ?? true,
  updatedAt: new Date().toISOString(),
}));

let inserted = 0;
let updated = 0;

db.transaction((tx) => {
  for (const row of rows) {
    const existing = tx
      .select({ id: qTable.id })
      .from(qTable)
      .where(sql`${qTable.id} = ${row.id}`)
      .get();
    if (existing) updated++;
    else inserted++;

    const { id: _id, ...updatable } = row;
    tx.insert(qTable).values(row).onConflictDoUpdate({ target: qTable.id, set: updatable }).run();

    // 풀이 이력 조회를 단순하게 하려고 progress 행을 미리 만들어 둔다.
    tx.insert(questionProgress).values({ questionId: row.id }).onConflictDoNothing().run();
  }
});

const total = db.select({ n: sql<number>`count(*)` }).from(qTable).get()?.n ?? 0;
sqlite.close();

console.log(`import 완료 — 신규 ${inserted}건, 갱신 ${updated}건`);
console.log(`DB: ${dbPath} (문제 총 ${total}건)`);
if (errorCount > 0) process.exit(1);
