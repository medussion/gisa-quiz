/**
 * 2단계: data/raw 에 받아둔 HTML에서 문제를 뽑아 정규화한다.
 *
 * 원문을 고치지 않는다. 문제·정답은 출처에 적힌 그대로 옮기고,
 * 영역/유형 분류와 채점 편의를 위한 표기 변형만 덧붙인다.
 * 결과: data/normalized/past-<연도>.json
 *
 * 사용법:
 *   npx tsx scripts/collect/parse-newbt.ts
 *   npx tsx scripts/collect/parse-newbt.ts 2024
 */
import fs from 'node:fs';
import path from 'node:path';
import { classifyCategory, classifyQuestionType } from './classify';
import { collapse, decodeEntities, preToText, stripTags } from './html';

const RAW_DIR = 'data/raw';
const OUT_DIR = 'data/normalized';
/** 코드가 이미지로만 올라온 문항의 그림을 꺼내 두는 곳 (Next.js가 그대로 서빙한다) */
const IMAGE_DIR = 'public/question-images';
/** 사람이 확인해 고친 내용. 다시 파싱해도 살아남게 마지막에 덮어쓴다. */
const CORRECTIONS_FILE = 'data/corrections.json';
/** 직접 쓴 해설 (출처에는 해설이 없다). 보정과 같은 방식으로 마지막에 덮어쓴다. */
const EXPLANATIONS_FILE = 'data/explanations.json';

interface ParsedQuestion {
  number: number;
  question: string;
  code: string | null;
  /** 본문이 base64 이미지로만 있는 경우 그 데이터 */
  imageData: { ext: string; buffer: Buffer } | null;
  answerRaw: string;
  wikiTopics: string[];
  detailUrl: string | null;
}

/** 한 회차 HTML에서 문항들을 뽑는다 */
export function parseRound(html: string): ParsedQuestion[] {
  const out: ParsedQuestion[] = [];
  const blocks = html.split(/<div class="blog-post" id="q(\d+)"/).slice(1);

  for (let i = 0; i < blocks.length; i += 2) {
    const questionId = blocks[i];
    const body = blocks[i + 1] ?? '';

    const subject = body.match(/<h5 class="subject">([\s\S]*?)<\/h5>/);
    const answer = body.match(/<div class="shortAnswer[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!subject || !answer) continue;

    const rawSubject = stripTags(subject[1]);
    const numberMatch = rawSubject.match(/^\s*(\d+)\s*\.\s*/);
    const number = numberMatch ? Number(numberMatch[1]) : out.length + 1;
    const question = collapse(rawSubject.replace(/^\s*\d+\s*\.\s*/, ''));

    const pres = [...body.matchAll(/<pre class="contents">([\s\S]*?)<\/pre>/g)].map((m) => preToText(m[1]));
    const code = pres.filter(Boolean).join('\n\n') || null;

    const wikiTopics = [...body.matchAll(/data-wiki-title='([^']+)'/g)].map((m) => decodeEntities(m[1]));

    // 코드·표·그림을 이미지로 올린 문항이 있다.
    // 글로 된 본문이 따로 있어도 그림에 표가 들어 있는 경우가 있으므로 항상 같이 챙긴다.
    let imageData: ParsedQuestion['imageData'] = null;
    const img = body.match(/src="data:image\/([a-z]+);base64,([A-Za-z0-9+/=\s]+)"/i);
    if (img) {
      imageData = { ext: img[1].toLowerCase(), buffer: Buffer.from(img[2].replace(/\s/g, ''), 'base64') };
    }

    out.push({
      number,
      question,
      code,
      imageData,
      answerRaw: collapse(stripTags(answer[1])),
      wikiTopics: [...new Set(wikiTopics)],
      detailUrl: questionId ? `https://newbt.kr/문제/${questionId}` : null,
    });
  }

  // 같은 번호가 두 번 실린 회차가 있다 (복원본이 겹쳐 올라간 경우). 내용이 긴 쪽을 남긴다.
  const byNumber = new Map<number, ParsedQuestion>();
  for (const q of out) {
    const prev = byNumber.get(q.number);
    const size = (x: ParsedQuestion) =>
      x.question.length + (x.code?.length ?? 0) + (x.imageData?.buffer.length ?? 0) + x.answerRaw.length;
    if (!prev || size(q) > size(prev)) byNumber.set(q.number, q);
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

const BLANK_MARKERS = [
  /^[①②③④⑤⑥⑦⑧⑨⑩]\s*/,
  /^\(\s*\d+\s*\)\s*/,
  /^\[\s*\d+\s*\]\s*/,
  /^\d+\s*\)\s*/,
  /^\d+\s*\.\s+/,
  /^[㉠㉡㉢㉣㉤]\s*/,
  /^[가나다라마]\s*[.)]\s*/,
];

/**
 * "A: 물리적 설계", "- 대칭키: DES...", "Cardinality : 5" 처럼
 * 이름표와 콜론이 붙은 항목은 서로 다른 빈칸이다.
 * 이름표가 알파벳/숫자 한 글자면 군더더기이므로 떼고, 뜻이 있는 낱말이면 그대로 둔다.
 */
const LABELLED = /^[-•*]?\s*([A-Ea-e]|\d|[^\s:：.)]{2,24})\s*[.:)：]\s+(\S[\s\S]*)$/;

function splitLabel(seg: string): { label: string; value: string } | null {
  const m = seg.match(LABELLED);
  if (!m) return null;
  return { label: m[1], value: m[2].trim() };
}

export interface AnswerShape {
  answer: string[];
  acceptedAnswers: string[];
  orderSensitive: boolean;
}

/**
 * 출처의 정답 문자열을 빈칸 배열로 바꾼다.
 *
 * - ①/(1)/1)/1. 로 시작하는 줄이 2개 이상이면 "빈칸 여러 개"로 본다 (순서 지킴)
 * - "- " 로 시작하면 같은 뜻의 다른 표현으로 본다 (첫 줄이 대표 정답)
 * - 그 밖에는 통째로 하나의 정답으로 둔다
 */
export function parseAnswer(raw: string, question = ''): AnswerShape {
  const segments = raw
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return { answer: [raw.trim()], acceptedAnswers: variantsOf(raw.trim()), orderSensitive: false };
  }

  /**
   * 출력 결과를 묻는 문제의 여러 줄 정답은 "서로 다른 답"이 아니라 한 답의 여러 줄이다.
   * 이걸 갈라 놓으면 전체를 제대로 적은 사람이 오답 처리되고
   * 한 줄만 적은 사람이 정답 처리되는 엉뚱한 채점이 된다.
   */
  const asksForOutput = /출력|실행\s?결과|결과를\s*(쓰|작성)/.test(question);
  const hasMarker = segments.some((seg) => BLANK_MARKERS.some((m) => m.test(seg)));
  if (asksForOutput && !hasMarker) {
    const joined = segments.join('\n');
    return {
      answer: [joined],
      // 한 줄로 이어 적는 사람도 있으므로 공백으로 이은 형태도 허용한다
      acceptedAnswers: [...new Set([segments.join(' '), segments.join(''), ...variantsOf(joined)])].filter(
        (a) => a !== joined,
      ),
      orderSensitive: false,
    };
  }

  const marked = segments.filter((s) => BLANK_MARKERS.some((m) => m.test(s)));
  if (marked.length >= 2) {
    const stripped = marked.map((s) => {
      let t = s;
      for (const m of BLANK_MARKERS) t = t.replace(m, '');
      return t.trim();
    });
    // "④ ③ ①" 처럼 번호 자체가 정답인 문항이 있다. 다 지워지면 원문을 그대로 쓴다.
    const answer = stripped.some((t) => t.length === 0) ? marked : stripped;
    // 번호가 안 붙은 나머지 줄은 보충 설명일 때가 많으므로 허용 답으로만 둔다
    const extras = segments.filter((s) => !marked.includes(s));
    return {
      answer,
      acceptedAnswers: [...new Set([...answer.flatMap(variantsOf), ...extras])],
      orderSensitive: true,
    };
  }

  // "A: ... / B: ..." 또는 "- 대칭키: ... / - 비대칭키: ..." 처럼 이름표가 붙으면 서로 다른 빈칸이다
  const labelled = segments.map(splitLabel);
  if (segments.length >= 2 && labelled.every((l): l is { label: string; value: string } => l !== null)) {
    // "(가", "A", "1" 처럼 한 글자짜리 이름표는 군더더기이므로 뗀다
    const isNoise = (label: string) => /^[가-마A-Ea-e\d]$/.test(label.replace(/^[(（[]/, ''));
    const answer = labelled.map((l) => (isNoise(l.label) ? l.value : `${l.label}: ${l.value}`));
    const accepted = new Set<string>();
    for (const l of labelled) accepted.add(l.value);
    for (const a of answer) for (const v of variantsOf(a)) accepted.add(v);
    for (const a of answer) accepted.delete(a);
    return { answer, acceptedAnswers: [...accepted], orderSensitive: true };
  }

  const dashed = segments.every((s) => /^[-•*]\s*/.test(s));
  const cleaned = segments.map((s) => s.replace(/^[-•*]\s*/, '').trim());

  // "- 설명1 / - 설명2" 처럼 같은 뜻을 다르게 쓴 경우
  if (dashed) {
    return { answer: [cleaned[0]], acceptedAnswers: cleaned.slice(1), orderSensitive: false };
  }

  // 표시가 없으면 임의로 빈칸을 나누지 않는다. 첫 줄을 대표로 두고 나머지는 허용 답으로.
  return { answer: [cleaned[0]], acceptedAnswers: cleaned.slice(1), orderSensitive: false };
}

/** 같은 정답의 흔한 표기 변형을 만든다 (내용을 지어내지 않는다) */
function variantsOf(answer: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t && t !== answer) out.add(t);
  };

  // 괄호 안 보충 설명 제거: "0 (숫자 0)" -> "0"
  add(answer.replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' '));
  // 괄호 안만: "UX(User Experience)" -> "User Experience"
  const inner = answer.match(/\(([^)]+)\)/);
  if (inner) add(inner[1]);
  // 따옴표 제거
  add(answer.replace(/["'`]/g, ''));
  // 끝 마침표/쉼표 제거
  add(answer.replace(/[.,;]+$/, ''));

  return [...out];
}

export interface Correction {
  id: string;
  reason: string;
  source?: string;
  patch: Record<string, unknown>;
}

export function loadExplanations(file = EXPLANATIONS_FILE): Map<string, string> {
  if (!fs.existsSync(file)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { explanations?: Record<string, string> };
  return new Map(Object.entries(parsed.explanations ?? {}));
}

/** 비어 있는 해설만 채운다. 이미 해설이 있으면 건드리지 않는다. */
export function applyExplanations(
  questions: Record<string, unknown>[],
  explanations: Map<string, string>,
): number {
  let applied = 0;
  for (const q of questions) {
    const text = explanations.get(String(q.id));
    if (!text?.trim()) continue;
    q.explanation = text.trim();
    applied++;
  }
  return applied;
}

export function loadCorrections(file = CORRECTIONS_FILE): Map<string, Correction> {
  if (!fs.existsSync(file)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { corrections?: Correction[] };
  return new Map((parsed.corrections ?? []).map((c) => [c.id, c]));
}

/** 보정을 덮어쓴다. reason 이 없는 보정은 무시한다 (근거 없는 수정을 막는다). */
export function applyCorrections(
  questions: Record<string, unknown>[],
  corrections: Map<string, Correction>,
): number {
  let applied = 0;
  for (const q of questions) {
    const c = corrections.get(String(q.id));
    if (!c || !c.reason?.trim()) continue;
    Object.assign(q, c.patch);
    applied++;
  }
  return applied;
}

function main() {
  const onlyYear = process.argv.slice(2).find((a) => /^\d{4}$/.test(a));
  const years = fs
    .readdirSync(RAW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .filter((y) => !onlyYear || y === onlyYear)
    .sort();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const corrections = loadCorrections();
  const explanations = loadExplanations();
  let grandTotal = 0;
  let imageCount = 0;
  let correctedCount = 0;
  let explainedCount = 0;

  for (const year of years) {
    const files = fs
      .readdirSync(path.join(RAW_DIR, year))
      .filter((f) => /^newbt-\d{4}-\d\.html$/.test(f))
      .sort();

    const questions: Record<string, unknown>[] = [];

    for (const file of files) {
      const round = Number(file.match(/-(\d)\.html$/)![1]);
      const full = path.join(RAW_DIR, year, file);
      const html = fs.readFileSync(full, 'utf8');

      const srcFile = full.replace(/\.html$/, '.source.json');
      const src = fs.existsSync(srcFile)
        ? (JSON.parse(fs.readFileSync(srcFile, 'utf8')) as { url: string })
        : { url: '' };

      const parsed = parseRound(html);
      if (parsed.length === 0) {
        console.log(`  ${year}년 ${round}회 — 문항을 찾지 못했습니다 (건너뜀)`);
        continue;
      }

      for (const p of parsed) {
        const shape = parseAnswer(p.answerRaw, p.question);
        const id = `${year}-${round}-${String(p.number).padStart(3, '0')}`;

        let image: string | null = null;
        if (p.imageData) {
          fs.mkdirSync(IMAGE_DIR, { recursive: true });
          const name = `${id}.${p.imageData.ext === 'jpeg' ? 'jpg' : p.imageData.ext}`;
          fs.writeFileSync(path.join(IMAGE_DIR, name), p.imageData.buffer);
          image = `/question-images/${name}`;
          imageCount++;
        }

        const ctx = {
          question: p.question,
          code: p.code ?? '',
          answer: shape.answer.join('\n'),
          wikiTopics: p.wikiTopics,
        };

        questions.push({
          id,
          sourceType: 'past_exam',
          sourceLabel: `${year}년 ${round}회 실기 복원 (newbt.kr 문제은행)`,
          sourceUrls: [src.url, p.detailUrl].filter(Boolean),
          year: Number(year),
          round,
          category: classifyCategory(ctx),
          subcategory: p.wikiTopics[0] ?? null,
          questionType: classifyQuestionType(ctx),
          question: p.question,
          code: p.code,
          codeLang: null,
          image,
          answer: shape.answer,
          acceptedAnswers: shape.acceptedAnswers,
          choices: null,
          hint: null,
          caseSensitive: false,
          orderSensitive: shape.orderSensitive,
          // 출처에 해설이 없다. 지어내지 않고 비워 둔다.
          explanation: '',
          difficulty: 3,
          // 한 곳에서만 확인했다. 교차검증 전까지 single_source.
          verificationStatus: 'single_source',
          verificationCount: 1,
          basedOn: null,
          active: true,
        });
      }

      const missing = Array.from({ length: 20 }, (_, i) => i + 1).filter(
        (n) => !parsed.some((p) => p.number === n),
      );
      const note = missing.length > 0 ? ` (출처에 없는 번호: ${missing.join(', ')})` : '';
      console.log(`  ${year}년 ${round}회 — ${parsed.length}문항${note}`);
    }

    explainedCount += applyExplanations(questions, explanations);
    correctedCount += applyCorrections(questions, corrections);

    if (questions.length === 0) continue;
    const out = path.join(OUT_DIR, `past-${year}.json`);
    fs.writeFileSync(out, JSON.stringify(questions, null, 2) + '\n', 'utf8');
    console.log(`${out} — ${questions.length}문항\n`);
    grandTotal += questions.length;
  }

  console.log(`합계 ${grandTotal}문항 (그림으로 된 본문 ${imageCount}건을 ${IMAGE_DIR} 에 저장)`);
  if (explanations.size > 0) {
    console.log(`해설 ${explainedCount}/${explanations.size}건을 ${EXPLANATIONS_FILE} 에서 채웠습니다.`);
  }
  if (corrections.size > 0) {
    console.log(`보정 ${correctedCount}/${corrections.size}건을 ${CORRECTIONS_FILE} 에서 덮어썼습니다.`);
  }
}

// 테스트에서 이 파일을 import 할 때는 실행되지 않게 한다
if (process.argv[1] && process.argv[1].endsWith('parse-newbt.ts')) main();
