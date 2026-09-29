import { normalizeForDedupe, similarity } from '../src/lib/grading';
import { validateQuestions } from '../src/lib/question-schema';
import { loadQuestionFiles, stamp, writeRejected } from './_util';

/**
 * 복원 사이트마다 문구가 달라 exact match만으로는 중복을 잡지 못한다.
 * 정규화 본문 + bigram 유사도로 후보를 뽑아 사람이 확인하도록 리포트만 만든다.
 * (자동 병합은 하지 않는다)
 */
// 사용법: npm run questions:duplicates -- [파일경로] [임계값]
//        npm run questions:duplicates -- 0.8
const args = process.argv.slice(2);
const explicit = args.find((a) => a.endsWith('.json'));
const thresholdArg = args.find((a) => !a.endsWith('.json') && !Number.isNaN(Number(a)));
const THRESHOLD = Number(thresholdArg ?? process.env.DUP_THRESHOLD ?? 0.85);

const files = loadQuestionFiles(explicit);
const all = files.flatMap(({ file, data }) =>
  validateQuestions(data).valid.map((q) => ({ ...q, __file: file })),
);

if (all.length === 0) {
  console.log('검사할 문제가 없습니다.');
  process.exit(0);
}

const norm = all.map((q) => normalizeForDedupe(`${q.question} ${q.code ?? ''}`));
// 본문이 그림으로만 있는 문항은 글자만 보면 전부 같아 보인다. 글자로는 비교할 수 없으니 뺀다.
const imageOnly = all.map((q) => Boolean(q.image) && !q.code);
const imageOnlyCount = imageOnly.filter(Boolean).length;

type Pair = { a: string; b: string; score: number; aFile: string; bFile: string; preview: string };
const pairs: Pair[] = [];

for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    if (imageOnly[i] || imageOnly[j]) continue;
    // 길이가 크게 다르면 건너뛴다 (비용 절약)
    const la = norm[i].length;
    const lb = norm[j].length;
    if (Math.min(la, lb) === 0) continue;
    if (Math.min(la, lb) / Math.max(la, lb) < 0.5) continue;

    const score = norm[i] === norm[j] ? 1 : similarity(norm[i], norm[j]);
    if (score >= THRESHOLD) {
      pairs.push({
        a: all[i].id,
        b: all[j].id,
        score: Math.round(score * 1000) / 1000,
        aFile: all[i].__file,
        bFile: all[j].__file,
        preview: all[i].question.slice(0, 60).replace(/\s+/g, ' '),
      });
    }
  }
}

pairs.sort((x, y) => y.score - x.score);

console.log(`문제 ${all.length}건 · 임계값 ${THRESHOLD} · 중복 후보 ${pairs.length}쌍`);
if (imageOnlyCount > 0) {
  console.log(`  (본문이 그림뿐인 ${imageOnlyCount}건은 글자로 비교할 수 없어 제외했습니다)`);
}
for (const p of pairs.slice(0, 50)) {
  console.log(`  ${p.score}  ${p.a} <-> ${p.b}   ${p.preview}...`);
}
if (pairs.length > 50) console.log(`  ... 외 ${pairs.length - 50}쌍`);

if (pairs.length > 0) {
  const out = writeRejected(`duplicates-${stamp()}.json`, { threshold: THRESHOLD, pairs });
  console.log(`전체 목록을 ${out} 에 기록했습니다. 확인 후 직접 병합하세요.`);
}
