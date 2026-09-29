/**
 * 3단계: 수집한 기출의 검증 상태를 올린다.
 *
 * 기계로 읽을 수 있는 독립 출처를 찾지 못했다. 그래서 억지로 'verified' 를 붙이지 않고,
 * 실제로 확인할 수 있는 것만 확인한다.
 *
 *  (가) 회차 간 반복 출제 대조
 *      같은 문제가 다른 회차에 다시 나온 경우, 두 복원은 서로 다른 시점·다른 작성자의 것이다.
 *      두 정답이 같으면 서로를 뒷받침하므로 cross_checked 로 올린다.
 *      다르면 둘 다 그대로 두고 사람이 볼 수 있게 보고서에 남긴다.
 *
 *  (나) 품질 점검
 *      정답이 비었거나, 문제를 그대로 베꼈거나, '가답안/확인 필요' 같은 메모가 섞였거나,
 *      보기·그림을 가리키는데 본문에 그림도 코드도 없는 문항을 찾아낸다.
 *      풀 수 없는 문항은 rejected 로 내려 출제에서 빼고 보고서에 남긴다.
 *
 * 사용법:
 *   npx tsx scripts/collect/cross-check.ts           # 보고서만
 *   npx tsx scripts/collect/cross-check.ts --write   # 파일에 반영
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeForCompare, normalizeForDedupe, similarity } from '../../src/lib/grading';
import type { RawQuestion } from '../../src/lib/question-schema';

const DIR = 'data/normalized';
const REPORT_DIR = 'data/rejected';
const SAME_QUESTION = 0.85;

interface CorrectionsDoc {
  _readme?: string[];
  corrections: { id: string; reason: string; source?: string; patch: Record<string, unknown> }[];
}

interface Loaded {
  file: string;
  questions: RawQuestion[];
}

function load(): Loaded[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.startsWith('past-') && f.endsWith('.json'))
    .sort()
    .map((f) => ({
      file: path.join(DIR, f),
      questions: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as RawQuestion[],
    }));
}

const answerKey = (q: RawQuestion) => q.answer.map((a) => normalizeForCompare(a)).join(' | ');

/** 괄호 안 풀이를 뗀 핵심 정답. "NAT(Network Address Translation)" -> "nat" */
const answerCore = (q: RawQuestion) =>
  q.answer.map((a) => normalizeForCompare(a.replace(/\([^)]*\)/g, ''))).join(' | ');

export interface RepeatPair {
  a: string;
  b: string;
  similarity: number;
  /** 정답이 통째로 같은가 */
  agree: boolean;
  /** 괄호 안 풀이를 빼면 같은가 (핵심은 맞고 곁가지만 다른 경우) */
  agreeCore: boolean;
  answerA: string[];
  answerB: string[];
  question: string;
}

/** 다른 회차에 다시 나온 문제를 찾아 정답이 일치하는지 본다 */
export function findRepeats(all: RawQuestion[]): RepeatPair[] {
  const norm = all.map((q) => normalizeForDedupe(`${q.question} ${q.code ?? ''}`));
  const pairs: RepeatPair[] = [];

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      // 같은 회차 안의 유사 문항은 반복 출제가 아니다
      if (all[i].year === all[j].year && all[i].round === all[j].round) continue;
      // 본문이 그림뿐이면 글자로는 비교할 수 없다
      if ((all[i].image && !all[i].code) || (all[j].image && !all[j].code)) continue;
      if (norm[i].length < 20 || norm[j].length < 20) continue;

      // 코드 문제는 지문이 거의 같아도 코드 한 줄이 다르면 다른 문제다.
      // 코드가 글자 하나까지 같을 때만 같은 문제로 본다.
      const codeI = normalizeForDedupe(all[i].code ?? '');
      const codeJ = normalizeForDedupe(all[j].code ?? '');
      if (codeI !== codeJ) continue;

      const min = Math.min(norm[i].length, norm[j].length);
      const max = Math.max(norm[i].length, norm[j].length);
      if (min / max < 0.7) continue;

      const score = similarity(norm[i], norm[j]);
      if (score < SAME_QUESTION) continue;

      pairs.push({
        a: all[i].id,
        b: all[j].id,
        similarity: Math.round(score * 1000) / 1000,
        agree: answerKey(all[i]) === answerKey(all[j]),
        agreeCore: answerCore(all[i]) === answerCore(all[j]),
        answerA: all[i].answer,
        answerB: all[j].answer,
        question: all[i].question.slice(0, 70).replace(/\s+/g, ' '),
      });
    }
  }

  return pairs.sort((x, y) => y.similarity - x.similarity);
}

export interface Problem {
  id: string;
  level: 'reject' | 'review';
  reason: string;
}

const META_NOISE = /정답\s?없음|가답안|미확정|확인\s?필요|추후\s?수정|복원\s?중|\?\?\?/;

/** 풀 수 없거나 미심쩍은 문항을 찾는다 */
export function audit(all: RawQuestion[]): Problem[] {
  const out: Problem[] = [];

  for (const q of all) {
    const answers = q.answer.map((a) => a.trim());

    if (answers.length === 0 || answers.every((a) => a.length === 0)) {
      out.push({ id: q.id, level: 'reject', reason: '정답이 비어 있습니다.' });
      continue;
    }
    if (answers.some((a) => a.length === 0)) {
      out.push({ id: q.id, level: 'review', reason: '빈칸 중 일부의 정답이 비어 있습니다.' });
    }
    if (META_NOISE.test(answers.join(' '))) {
      out.push({ id: q.id, level: 'review', reason: `정답에 확정되지 않았다는 표시가 있습니다: ${answers.join(' / ').slice(0, 40)}` });
    }
    if (normalizeForCompare(answers.join(' ')) === normalizeForCompare(q.question)) {
      out.push({ id: q.id, level: 'reject', reason: '정답이 문제 본문과 같습니다.' });
      continue;
    }

    // 그림을 가리키는데 그림이 없으면, 글로 된 설명이 있어도 답을 고를 수 없다
    if (/그림|도표|화면에서|다이어그램/.test(q.question) && !q.image) {
      out.push({ id: q.id, level: 'reject', reason: '그림을 보고 답하라는데 그림이 없습니다.' });
      continue;
    }

    // 보기·표·코드를 가리키는데 본문에 아무것도 없으면 풀 수 없다
    const refersToMaterial = /보기|다음\s?표|아래\s?표|아래\s?코드|다음\s?코드|위\s?코드/.test(q.question);
    if (refersToMaterial && !q.code && !q.image) {
      out.push({ id: q.id, level: 'reject', reason: '보기/표/코드를 가리키는데 본문에 그 자료가 없습니다.' });
    }
  }

  return out;
}

function main() {
  const write = process.argv.includes('--write');
  const loaded = load();
  const all = loaded.flatMap((l) => l.questions);
  console.log(`기출 ${all.length}문항을 점검합니다.\n`);

  // ── (가) 반복 출제 대조 ─────────────────────────────────
  const repeats = findRepeats(all);
  const agreed = repeats.filter((p) => p.agree);
  const coreOnly = repeats.filter((p) => !p.agree && p.agreeCore);
  const conflict = repeats.filter((p) => !p.agreeCore);

  console.log('[회차 간 반복 출제 대조]');
  console.log(`  같은 문제로 보이는 쌍: ${repeats.length}`);
  console.log(`  정답 완전 일치: ${agreed.length} · 핵심만 일치: ${coreOnly.length} · 불일치: ${conflict.length}`);
  for (const p of agreed) console.log(`    O  ${p.a} = ${p.b}  ${p.question}…`);
  for (const p of coreOnly) {
    console.log(`    ~  ${p.a} ≈ ${p.b}  ${p.question}…`);
    console.log(`         ${p.a}: ${p.answerA.join(' / ').slice(0, 70)}`);
    console.log(`         ${p.b}: ${p.answerB.join(' / ').slice(0, 70)}`);
    console.log('         → 핵심 정답은 같고 괄호 안 풀이만 다릅니다. 어느 쪽이 맞는지 확인하세요.');
  }
  for (const p of conflict) {
    console.log(`    X  ${p.a} ≠ ${p.b}  ${p.question}…`);
    console.log(`         ${p.a}: ${p.answerA.join(' / ').slice(0, 70)}`);
    console.log(`         ${p.b}: ${p.answerB.join(' / ').slice(0, 70)}`);
  }

  // ── (나) 품질 점검 ──────────────────────────────────────
  const problems = audit(all);
  const rejects = problems.filter((p) => p.level === 'reject');
  const reviews = problems.filter((p) => p.level === 'review');

  console.log('\n[품질 점검]');
  console.log(`  풀 수 없어 출제에서 빼야 할 문항: ${rejects.length}`);
  for (const p of rejects) console.log(`    - ${p.id}: ${p.reason}`);
  console.log(`  사람이 봐야 할 문항: ${reviews.length}`);
  for (const p of reviews.slice(0, 20)) console.log(`    - ${p.id}: ${p.reason}`);
  if (reviews.length > 20) console.log(`    ... 외 ${reviews.length - 20}건`);

  // ── 보고서 ─────────────────────────────────────────────
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'cross-check.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        total: all.length,
        repeats: {
          agreed: agreed.length,
          coreOnly: coreOnly.length,
          conflict: conflict.length,
          pairs: repeats,
        },
        audit: problems,
        note: '기계로 읽을 수 있는 독립 출처를 찾지 못해, 회차 간 반복 출제 대조와 품질 점검만 수행했습니다.',
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`\n보고서: ${reportPath}`);

  if (!write) {
    console.log('\n(--write 를 붙이면 검증 상태를 파일에 반영합니다)');
    return;
  }

  // ── 반영 ───────────────────────────────────────────────
  // past-*.json 은 다시 파싱하면 덮어써진다. 결론은 보정 파일에 남겨야 살아남는다.
  const CORRECTIONS = 'data/corrections.json';
  const doc = fs.existsSync(CORRECTIONS)
    ? (JSON.parse(fs.readFileSync(CORRECTIONS, 'utf8')) as CorrectionsDoc)
    : { corrections: [] };

  const byId = new Map(doc.corrections.map((c) => [c.id, c]));
  const merge = (id: string, reason: string, patch: Record<string, unknown>) => {
    const prev = byId.get(id);
    if (prev) {
      prev.patch = { ...prev.patch, ...patch };
      if (!prev.reason.includes(reason)) prev.reason = `${prev.reason} / ${reason}`;
    } else {
      byId.set(id, { id, reason, patch });
    }
  };

  let upgraded = 0;
  let rejected = 0;

  // 핵심 정답이 같으면 서로 다른 복원본이 서로를 뒷받침한다고 본다
  for (const p of [...agreed, ...coreOnly]) {
    const reason = `${p.a} 와 ${p.b} 가 다른 회차에 같은 문제로 다시 나왔고 정답이 ${
      p.agree ? '같습니다' : '핵심까지 같습니다'
    }. 서로 다른 복원본이 일치하므로 cross_checked 로 올립니다.`;
    for (const id of [p.a, p.b]) {
      merge(id, reason, { verificationStatus: 'cross_checked', verificationCount: 2 });
      upgraded++;
    }
  }

  for (const p of rejects) {
    merge(p.id, `${p.reason} 그대로는 풀 수 없어 출제에서 뺍니다.`, {
      verificationStatus: 'rejected',
      active: false,
    });
    rejected++;
  }

  // 전에 뺐지만 이제는 풀 수 있게 된 문항(그림을 되찾은 경우 등)은 제외를 되돌린다.
  const stillRejected = new Set(rejects.map((p) => p.id));
  let restored = 0;
  for (const c of byId.values()) {
    if (c.patch.verificationStatus !== 'rejected' || stillRejected.has(c.id)) continue;
    delete c.patch.verificationStatus;
    delete c.patch.active;
    c.reason = `${c.reason} (이후 자료가 보완되어 출제 제외를 되돌림)`;
    restored++;
  }
  // 아무 내용도 남지 않은 보정은 지운다
  for (const [id, c] of [...byId]) {
    if (Object.keys(c.patch).length === 0) byId.delete(id);
  }

  doc.corrections = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(CORRECTIONS, JSON.stringify(doc, null, 2) + '\n', 'utf8');

  console.log(
    `\n${CORRECTIONS} 에 반영 — cross_checked ${upgraded}건 · rejected ${rejected}건${
      restored > 0 ? ` · 제외 되돌림 ${restored}건` : ''
    }`,
  );
  console.log('`npm run collect:parse && npm run questions:import` 로 적용하세요.');
}

if (process.argv[1] && process.argv[1].endsWith('cross-check.ts')) main();
