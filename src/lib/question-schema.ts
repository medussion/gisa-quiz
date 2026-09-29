import {
  CATEGORY_IDS,
  QUESTION_TYPE_IDS,
  SOURCE_TYPE_IDS,
  VERIFICATION_STATUSES,
} from './constants';

/** data/normalized/questions.json 한 항목의 형태 */
export interface RawQuestion {
  id: string;
  sourceType: string;
  sourceLabel?: string;
  sourceUrls?: string[];
  year?: number | null;
  round?: number | null;
  category: string;
  subcategory?: string | null;
  questionType: string;
  question: string;
  code?: string | null;
  codeLang?: string | null;
  image?: string | null;
  answer: string[];
  acceptedAnswers?: string[];
  choices?: string[] | null;
  hint?: string | null;
  caseSensitive?: boolean;
  orderSensitive?: boolean;
  explanation?: string;
  difficulty?: number;
  verificationStatus?: string;
  verificationCount?: number;
  basedOn?: string | null;
  active?: boolean;
}

export interface ValidationIssue {
  id: string;
  index: number;
  level: 'error' | 'warn';
  message: string;
}

export interface ValidationResult {
  valid: RawQuestion[];
  rejected: { question: unknown; issues: ValidationIssue[] }[];
  issues: ValidationIssue[];
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function validateQuestions(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const valid: RawQuestion[] = [];
  const rejected: ValidationResult['rejected'] = [];

  if (!Array.isArray(input)) {
    issues.push({ id: '-', index: -1, level: 'error', message: '최상위 값이 배열이 아닙니다.' });
    return { valid, rejected, issues };
  }

  const seen = new Map<string, number>();

  input.forEach((item, index) => {
    const own: ValidationIssue[] = [];
    const q = item as Partial<RawQuestion>;
    const id = isNonEmptyString(q.id) ? q.id : `(index ${index})`;
    const err = (message: string) => own.push({ id, index, level: 'error', message });
    const warn = (message: string) => own.push({ id, index, level: 'warn', message });

    if (!item || typeof item !== 'object') {
      err('객체가 아닙니다.');
    } else {
      if (!isNonEmptyString(q.id)) err('id가 비어 있습니다.');
      else if (seen.has(q.id)) err(`id 중복 (앞선 index ${seen.get(q.id)})`);
      else seen.set(q.id, index);

      if (!isNonEmptyString(q.question)) err('question이 비어 있습니다.');

      if (!Array.isArray(q.answer) || q.answer.length === 0) {
        err('answer는 1개 이상의 문자열 배열이어야 합니다.');
      } else if (!q.answer.every(isNonEmptyString)) {
        err('answer 항목 중 빈 문자열이 있습니다.');
      }

      if (!isNonEmptyString(q.category) || !CATEGORY_IDS.includes(q.category)) {
        err(`category가 유효하지 않습니다: ${String(q.category)}`);
      }
      if (!isNonEmptyString(q.questionType) || !QUESTION_TYPE_IDS.includes(q.questionType)) {
        err(`questionType이 유효하지 않습니다: ${String(q.questionType)}`);
      }
      if (!isNonEmptyString(q.sourceType) || !SOURCE_TYPE_IDS.includes(q.sourceType)) {
        err(`sourceType이 유효하지 않습니다: ${String(q.sourceType)}`);
      }
      if (
        q.verificationStatus !== undefined &&
        !(VERIFICATION_STATUSES as readonly string[]).includes(q.verificationStatus)
      ) {
        err(`verificationStatus가 유효하지 않습니다: ${String(q.verificationStatus)}`);
      }
      if (q.difficulty !== undefined && (typeof q.difficulty !== 'number' || q.difficulty < 1 || q.difficulty > 5)) {
        err('difficulty는 1~5 사이 숫자여야 합니다.');
      }
      if (q.questionType === 'multiple_choice' && (!Array.isArray(q.choices) || q.choices.length < 2)) {
        err('객관식은 choices가 2개 이상 필요합니다.');
      }

      if (q.sourceType === 'generated' && !isNonEmptyString(q.basedOn)) {
        warn('generated인데 basedOn이 없습니다.');
      }
      if (q.sourceType === 'past_exam' && (q.year == null || q.round == null)) {
        warn('past_exam인데 year/round가 없습니다.');
      }
      if (q.sourceType === 'past_exam' && (!Array.isArray(q.sourceUrls) || q.sourceUrls.length === 0)) {
        warn('past_exam인데 sourceUrls가 비어 있습니다. 출처를 남겨주세요.');
      }
      if (!isNonEmptyString(q.explanation)) warn('explanation이 비어 있습니다.');
    }

    issues.push(...own);
    if (own.some((i) => i.level === 'error')) {
      rejected.push({ question: item, issues: own });
    } else {
      valid.push(normalizeQuestion(q as RawQuestion));
    }
  });

  return { valid, rejected, issues };
}

export function normalizeQuestion(q: RawQuestion): RawQuestion {
  return {
    ...q,
    sourceLabel: q.sourceLabel ?? '',
    sourceUrls: q.sourceUrls ?? [],
    year: q.year ?? null,
    round: q.round ?? null,
    subcategory: q.subcategory ?? null,
    code: q.code ?? null,
    codeLang: q.codeLang ?? null,
    image: q.image ?? null,
    acceptedAnswers: q.acceptedAnswers ?? [],
    choices: q.choices ?? null,
    hint: q.hint ?? null,
    caseSensitive: q.caseSensitive ?? false,
    orderSensitive: q.orderSensitive ?? false,
    explanation: q.explanation ?? '',
    difficulty: q.difficulty ?? 3,
    verificationStatus: q.verificationStatus ?? (q.sourceType === 'past_exam' ? 'single_source' : 'unverified'),
    verificationCount: q.verificationCount ?? 0,
    basedOn: q.basedOn ?? null,
    active: q.active ?? true,
  };
}
