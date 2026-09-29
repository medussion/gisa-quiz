import 'server-only';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { questionProgress, questions } from '@/db/schema';
import { sourceBadge } from '@/lib/constants';
import { buildHint, type Hint } from '@/lib/hints';
import { priorityScore, type ProgressLike } from '@/lib/scheduling';
import type { QuestionDTO, QuestionFilters, RevealedQuestion } from '@/lib/types';

export type QuestionRow = typeof questions.$inferSelect;
export type ProgressRow = typeof questionProgress.$inferSelect;

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function toDTO(q: QuestionRow): QuestionDTO {
  return {
    id: q.id,
    sourceType: q.sourceType,
    sourceLabel: q.sourceLabel,
    sourceUrls: parseJsonArray(q.sourceUrls),
    year: q.year,
    round: q.round,
    category: q.category,
    subcategory: q.subcategory,
    questionType: q.questionType,
    question: q.question,
    code: q.code,
    codeLang: q.codeLang,
    image: q.image,
    choices: q.choices ? parseJsonArray(q.choices) : null,
    difficulty: q.difficulty,
    verificationStatus: q.verificationStatus,
    badge: sourceBadge(q.sourceType, q.verificationStatus),
  };
}

export function toRevealed(q: QuestionRow): RevealedQuestion {
  return {
    ...toDTO(q),
    answer: parseJsonArray(q.answer),
    acceptedAnswers: parseJsonArray(q.acceptedAnswers),
    explanation: q.explanation,
  };
}

export interface SelectionOptions extends QuestionFilters {
  mode: string;
  count: number;
  /** 모의고사 등에서 특정 문제를 제외할 때 */
  excludeIds?: string[];
}

interface Candidate {
  question: QuestionRow;
  progress: ProgressRow | null;
}

function filterConditions(opts: SelectionOptions): SQL[] {
  const conds: SQL[] = [eq(questions.active, true)];
  if (opts.category) conds.push(eq(questions.category, opts.category));
  if (opts.questionType) conds.push(eq(questions.questionType, opts.questionType));
  if (opts.sourceType) conds.push(eq(questions.sourceType, opts.sourceType));
  if (opts.year) conds.push(eq(questions.year, opts.year));
  if (opts.round) conds.push(eq(questions.round, opts.round));
  if (opts.difficulty) conds.push(eq(questions.difficulty, opts.difficulty));
  if (opts.pastOnly) conds.push(eq(questions.sourceType, 'past_exam'));
  if (opts.excludeGenerated) conds.push(sql`${questions.sourceType} <> 'generated'`);
  conds.push(sql`${questions.verificationStatus} <> 'rejected'`);
  return conds;
}

function loadCandidates(opts: SelectionOptions): Candidate[] {
  const rows = db
    .select({ q: questions, p: questionProgress })
    .from(questions)
    .leftJoin(questionProgress, eq(questions.id, questionProgress.questionId))
    .where(and(...filterConditions(opts)))
    .all();

  const exclude = new Set(opts.excludeIds ?? []);
  return rows
    .filter((r) => !exclude.has(r.q.id))
    .map((r) => ({ question: r.q, progress: r.p }));
}

function isRecentWrong(p: ProgressRow | null, days = 7): boolean {
  if (!p?.lastWrongAt) return false;
  return Date.now() - new Date(p.lastWrongAt).getTime() <= days * 86_400_000;
}

function applyModeFilter(mode: string, list: Candidate[]): Candidate[] {
  switch (mode) {
    case 'wrong':
      return list.filter((c) => (c.progress?.wrongCount ?? 0) > 0);
    case 'recent_wrong':
      return list.filter((c) => isRecentWrong(c.progress));
    case 'code':
      return list.filter((c) => c.question.questionType === 'code_output');
    case 'sql':
      return list.filter((c) => c.question.questionType === 'sql');
    case 'memorize':
      return list.filter((c) => ['term', 'short_answer'].includes(c.question.questionType));
    case 'descriptive':
      return list.filter((c) => c.question.questionType === 'descriptive');
    case 'review_due':
      return list.filter(
        (c) => c.progress?.nextReviewAt != null && new Date(c.progress.nextReviewAt).getTime() <= Date.now(),
      );
    case 'bookmarked':
      return list.filter((c) => c.progress?.bookmarked === true);
    case 'past_only':
      return list.filter((c) => c.question.sourceType === 'past_exam');
    default:
      return list;
  }
}

function toProgressLike(p: ProgressRow | null): ProgressLike | null {
  if (!p || p.attemptCount === 0) return null;
  return {
    attemptCount: p.attemptCount,
    correctCount: p.correctCount,
    wrongCount: p.wrongCount,
    streak: p.streak,
    lastAnsweredAt: p.lastAnsweredAt,
    lastWrongAt: p.lastWrongAt,
    nextReviewAt: p.nextReviewAt,
    masteryScore: p.masteryScore,
  };
}

/** 모드 + 필터 + 우선순위로 출제할 문제를 고른다. */
export function selectQuestions(opts: SelectionOptions): QuestionRow[] {
  const all = loadCandidates(opts);
  let pool = applyModeFilter(opts.mode, all);

  // 집중 모드인데 대상이 없으면 전체에서 뽑아 빈 화면을 피한다.
  if (pool.length === 0 && opts.mode !== 'random') pool = all;
  if (pool.length === 0) return [];

  if (opts.mode === 'random' || opts.mode === 'mock_exam') {
    return shuffle(pool).slice(0, opts.count).map((c) => c.question);
  }

  const now = new Date();
  const scored = pool.map((c) => ({
    question: c.question,
    // 같은 세트가 반복되지 않도록 약간의 흔들림을 준다.
    score: priorityScore({
      progress: toProgressLike(c.progress),
      sourceType: c.question.sourceType,
      difficulty: c.question.difficulty,
      now,
    }) + Math.random() * 6,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.count).map((s) => s.question);
}

export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getQuestionsByIds(ids: string[]): QuestionRow[] {
  if (ids.length === 0) return [];
  const rows = db.select().from(questions).where(inArray(questions.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is QuestionRow => Boolean(r));
}

export function getQuestion(id: string): QuestionRow | undefined {
  return db.select().from(questions).where(eq(questions.id, id)).get();
}

/** 정답 자체는 내보내지 않고 힌트 문구만 만들어 준다. */
export function getHint(id: string): Hint | null {
  const q = getQuestion(id);
  if (!q) return null;
  return buildHint({
    questionType: q.questionType,
    answer: parseJsonArray(q.answer),
    hint: q.hint,
    subcategory: q.subcategory,
  });
}

export function countByMode(opts: SelectionOptions): number {
  return applyModeFilter(opts.mode, loadCandidates(opts)).length;
}
