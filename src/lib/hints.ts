/**
 * 힌트 만들기.
 *
 * 문제에 `hint` 를 직접 적어두면 그걸 그대로 쓰고,
 * 없으면 정답의 "모양"(글자 수 · 첫 글자 · 숫자 자릿수 등)으로 자동 생성한다.
 * 정답 전체를 흘리지 않는 것이 원칙이라 1글자짜리 정답은 첫 글자를 공개하지 않는다.
 */

export interface HintSource {
  questionType: string;
  answer: string[];
  hint?: string | null;
  subcategory?: string | null;
}

export interface Hint {
  text: string;
  /** 문제에 적힌 힌트면 false, 정답 모양에서 만들어낸 것이면 true */
  auto: boolean;
}

const isNumeric = (s: string) => /^-?\d+(\.\d+)?$/.test(s);
const isAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);

/** 공백을 뺀 글자 수 */
function visibleLength(s: string): number {
  return s.replace(/\s+/g, '').length;
}

function describeAnswer(answer: string, questionType: string): string {
  const trimmed = answer.trim();

  if (questionType === 'sql') {
    const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase() ?? '';
    return firstWord ? `${firstWord} 로 시작하는 SQL문입니다.` : 'SQL문을 작성하세요.';
  }

  if (isNumeric(trimmed)) {
    const digits = trimmed.replace(/[^0-9]/g, '').length;
    const sign = trimmed.startsWith('-') ? '음수 ' : '';
    return `${sign}${digits}자리 숫자입니다.`;
  }

  const len = visibleLength(trimmed);
  const kind = isAscii(trimmed) ? '영문/기호' : '한글';

  // 1글자짜리는 첫 글자를 알려주면 정답 그 자체가 된다.
  if (len <= 1) return `${kind} 1글자입니다.`;

  const first = trimmed.replace(/\s+/g, '')[0];
  return `${kind} ${len}글자, 「${first}」(으)로 시작합니다.`;
}

export function buildHint(q: HintSource): Hint {
  const custom = (q.hint ?? '').trim();
  if (custom) return { text: custom, auto: false };

  const parts: string[] = [];
  const sub = (q.subcategory ?? '').trim();
  if (sub) parts.push(`분야: ${sub}`);

  if (q.questionType === 'multiple_choice') {
    parts.push('보기 중 하나입니다. 확실히 아닌 것부터 지워보세요.');
    return { text: parts.join('\n'), auto: true };
  }

  const answers = q.answer.filter((a) => a.trim().length > 0);
  if (answers.length === 0) {
    return { text: parts.join('\n') || '힌트가 없습니다.', auto: true };
  }

  if (answers.length === 1) {
    parts.push(describeAnswer(answers[0], q.questionType));
  } else {
    parts.push(`빈칸 ${answers.length}개입니다.`);
    answers.forEach((a, i) => parts.push(`(${i + 1}) ${describeAnswer(a, q.questionType)}`));
  }

  return { text: parts.join('\n'), auto: true };
}
