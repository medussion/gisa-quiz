import { validateQuestions, type RawQuestion } from '../src/lib/question-schema';
import { loadQuestionFiles, stamp, writeRejected } from './_util';

const explicit = process.argv[2];
const files = loadQuestionFiles(explicit);

if (files.length === 0) {
  console.log('data/normalized 에 JSON 파일이 없습니다.');
  process.exit(0);
}

let totalErrors = 0;
let totalWarns = 0;
let totalValid = 0;
const allRejected: unknown[] = [];
const seenIds = new Set<string>();

for (const { file, data } of files) {
  const res = validateQuestions(data);
  const errors = res.issues.filter((i) => i.level === 'error');
  const warns = res.issues.filter((i) => i.level === 'warn');

  // 파일 간 id 중복도 검사한다.
  const crossDup: string[] = [];
  for (const q of res.valid as RawQuestion[]) {
    if (seenIds.has(q.id)) crossDup.push(q.id);
    else seenIds.add(q.id);
  }

  console.log(`\n[${file}]`);
  console.log(`  통과 ${res.valid.length} / 오류 ${errors.length} / 경고 ${warns.length}`);
  for (const i of errors) console.log(`  ERROR [${i.id}] ${i.message}`);
  for (const i of warns) console.log(`  WARN  [${i.id}] ${i.message}`);
  for (const id of crossDup) {
    console.log(`  ERROR [${id}] 다른 파일과 id가 중복됩니다.`);
    totalErrors++;
  }

  totalErrors += errors.length;
  totalWarns += warns.length;
  totalValid += res.valid.length;
  allRejected.push(...res.rejected);
}

console.log(`\n합계: 통과 ${totalValid} · 오류 ${totalErrors} · 경고 ${totalWarns}`);

if (allRejected.length > 0) {
  const out = writeRejected(`rejected-${stamp()}.json`, allRejected);
  console.log(`거절된 ${allRejected.length}건을 ${out} 에 기록했습니다.`);
}

process.exit(totalErrors > 0 ? 1 : 0);
