/**
 * 답안 정규화 및 채점.
 *
 * SQL은 MVP에서 의미론적 채점을 하지 않는다. 정규화 비교로 1차 판정하고,
 * 모범답안을 보여준 뒤 사용자가 수동으로 정/오답을 보정할 수 있게 한다.
 */

/** 공통 정규화: trim, 연속 공백 1칸, 줄바꿈 통일 */
export function normalizeBasic(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t 　]+/g, ' ').replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** 비교용 정규화: 기본 정규화 + 대소문자/구두점 처리 */
export function normalizeForCompare(input: string, opts: { caseSensitive?: boolean } = {}): string {
  let s = normalizeBasic(input);
  if (!opts.caseSensitive) s = s.toLowerCase();
  // 한글 조사/구두점 노이즈 제거 (답 자체가 기호인 경우를 위해 전부 지우지는 않는다)
  s = s.replace(/[.,;]+$/g, '').trim();
  return s;
}

/** SQL 전용 정규화: 키워드 대문자 무시, 공백/줄바꿈/후행 세미콜론 정리 */
export function normalizeSql(input: string): string {
  return normalizeBasic(input)
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/\s*;\s*$/g, '')
    .replace(/\n/g, ' ')
    .replace(/ {2,}/g, ' ')
    .toLowerCase()
    .trim();
}

/** 중복 탐지용 정규화: 공백/기호를 최대한 걷어낸 본문 */
export function normalizeForDedupe(input: string): string {
  return normalizeBasic(input)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** 0.0~1.0 유사도 (Dice coefficient, bigram 기반) */
export function similarity(a: string, b: string): number {
  const x = normalizeForDedupe(a);
  const y = normalizeForDedupe(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ga = bigrams(x);
  const gb = bigrams(y);
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const n of ga.values()) totalA += n;
  for (const n of gb.values()) totalB += n;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  if (totalA + totalB === 0) return 0;
  return (2 * overlap) / (totalA + totalB);
}

export interface GradableQuestion {
  questionType: string;
  /** 정답 목록. 길이가 2 이상이면 "빈칸 여러 개"를 뜻한다. */
  answer: string[];
  /** 각 정답에 대해 추가로 허용하는 표기 */
  acceptedAnswers: string[];
  caseSensitive: boolean;
  orderSensitive: boolean;
}

export interface GradeResult {
  isCorrect: boolean;
  /** 0.0 ~ 1.0 */
  score: number;
  /** 빈칸별 정오 (단일 정답이면 길이 1) */
  perSlot: boolean[];
  /** SQL 등 자동 채점을 신뢰하기 어려운 경우 true */
  needsManualCheck: boolean;
}

function splitUserAnswer(userAnswer: string, slots: number): string[] {
  if (slots <= 1) return [userAnswer];
  const lines = normalizeBasic(userAnswer).split('\n').filter((l) => l.length > 0);
  if (lines.length >= slots) return lines.slice(0, slots);
  // 줄바꿈이 부족하면 쉼표로도 나눠본다
  const commaParts = normalizeBasic(userAnswer)
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= slots) return commaParts.slice(0, slots);
  return [...lines, ...Array(Math.max(0, slots - lines.length)).fill('')];
}

function matches(user: string, candidates: string[], q: GradableQuestion): boolean {
  const norm = (s: string) =>
    q.questionType === 'sql' ? normalizeSql(s) : normalizeForCompare(s, { caseSensitive: q.caseSensitive });
  const u = norm(user);
  if (!u) return false;
  return candidates.some((c) => norm(c) === u);
}

export function gradeAnswer(userAnswer: string, q: GradableQuestion): GradeResult {
  const slots = Math.max(1, q.answer.length);
  // SQL과 서술형은 문자열 비교로 맞고 틀림을 가릴 수 없다. 사람이 보정한다.
  const needsManualCheck = q.questionType === 'sql' || q.questionType === 'descriptive';

  if (slots === 1) {
    const ok = matches(userAnswer, [q.answer[0] ?? '', ...q.acceptedAnswers], q);
    return { isCorrect: ok, score: ok ? 1 : 0, perSlot: [ok], needsManualCheck };
  }

  const parts = splitUserAnswer(userAnswer, slots);

  if (!q.orderSensitive) {
    // 순서를 따지지 않을 때: 그리디 매칭
    const remaining = q.answer.map((a, i) => ({ a, i }));
    const perSlot = Array(slots).fill(false);
    for (const p of parts) {
      const hitIdx = remaining.findIndex((r) => matches(p, [r.a, ...q.acceptedAnswers], q));
      if (hitIdx >= 0) {
        perSlot[remaining[hitIdx].i] = true;
        remaining.splice(hitIdx, 1);
      }
    }
    const hit = perSlot.filter(Boolean).length;
    return { isCorrect: hit === slots, score: hit / slots, perSlot, needsManualCheck };
  }

  const perSlot = q.answer.map((a, i) => matches(parts[i] ?? '', [a, ...q.acceptedAnswers], q));
  const hit = perSlot.filter(Boolean).length;
  return { isCorrect: hit === slots, score: hit / slots, perSlot, needsManualCheck };
}
