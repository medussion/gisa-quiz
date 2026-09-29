import type { RawQuestion } from './question-schema';

/** 폼에서 온 값(문자열 위주)을 RawQuestion 모양으로 바꾼다. 추가/수정이 같이 쓴다. */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const lines = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== '' ? n : null;
};

export function parseQuestionInput(body: Record<string, unknown>): Partial<RawQuestion> {
  return {
    id: str(body.id) || undefined,
    sourceType: str(body.sourceType) || 'user',
    sourceLabel: str(body.sourceLabel),
    sourceUrls: lines(body.sourceUrls),
    year: num(body.year),
    round: num(body.round),
    category: str(body.category),
    subcategory: str(body.subcategory) || null,
    questionType: str(body.questionType),
    question: str(body.question),
    code: str(body.code) || null,
    codeLang: str(body.codeLang) || null,
    answer: lines(body.answer),
    acceptedAnswers: lines(body.acceptedAnswers),
    choices: lines(body.choices).length > 0 ? lines(body.choices) : null,
    caseSensitive: Boolean(body.caseSensitive),
    orderSensitive: Boolean(body.orderSensitive),
    hint: str(body.hint) || null,
    explanation: str(body.explanation),
    difficulty: num(body.difficulty) ?? 3,
    verificationStatus: str(body.verificationStatus) || undefined,
    basedOn: str(body.basedOn) || null,
    active: body.active === undefined ? true : Boolean(body.active),
  };
}
