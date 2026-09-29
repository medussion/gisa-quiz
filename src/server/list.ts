import 'server-only';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { questionProgress, questions } from '@/db/schema';
import { sourceBadge } from '@/lib/constants';

export interface ListRow {
  id: string;
  question: string;
  category: string;
  questionType: string;
  sourceType: string;
  sourceLabel: string;
  year: number | null;
  round: number | null;
  difficulty: number;
  badge: string;
  answer: string[];
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  lastWrongAt: string | null;
  nextReviewAt: string | null;
  masteryScore: number;
  bookmarked: boolean;
  memo: string;
  active: boolean;
}

export interface ListFilters {
  category?: string;
  questionType?: string;
  sourceType?: string;
  year?: number;
  round?: number;
  difficulty?: number;
  bookmarked?: boolean;
  wrongOnly?: boolean;
  /** 기본은 출제 대상만. 'inactive'는 제외된 문제만, 'all'은 전부 */
  activeFilter?: 'active' | 'inactive' | 'all';
  search?: string;
  limit?: number;
}

function parse(value: string | null): string[] {
  if (!value) return [];
  try {
    const p = JSON.parse(value);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export function listQuestions(f: ListFilters = {}): ListRow[] {
  const conds: SQL[] = [];
  if (f.activeFilter === 'inactive') conds.push(eq(questions.active, false));
  else if (f.activeFilter !== 'all') conds.push(eq(questions.active, true));
  if (f.category) conds.push(eq(questions.category, f.category));
  if (f.questionType) conds.push(eq(questions.questionType, f.questionType));
  if (f.sourceType) conds.push(eq(questions.sourceType, f.sourceType));
  if (f.year) conds.push(eq(questions.year, f.year));
  if (f.round) conds.push(eq(questions.round, f.round));
  if (f.difficulty) conds.push(eq(questions.difficulty, f.difficulty));
  if (f.bookmarked) conds.push(eq(questionProgress.bookmarked, true));
  if (f.wrongOnly) conds.push(sql`coalesce(${questionProgress.wrongCount}, 0) > 0`);
  if (f.search) {
    const like = `%${f.search}%`;
    conds.push(sql`(${questions.question} LIKE ${like} OR ${questions.answer} LIKE ${like})`);
  }

  const rows = db
    .select({ q: questions, p: questionProgress })
    .from(questions)
    .leftJoin(questionProgress, eq(questions.id, questionProgress.questionId))
    .where(and(...conds))
    .orderBy(desc(questionProgress.lastWrongAt), questions.id)
    .limit(f.limit ?? 300)
    .all();

  return rows.map(({ q, p }) => ({
    id: q.id,
    question: q.question,
    category: q.category,
    questionType: q.questionType,
    sourceType: q.sourceType,
    sourceLabel: q.sourceLabel,
    year: q.year,
    round: q.round,
    difficulty: q.difficulty,
    badge: sourceBadge(q.sourceType, q.verificationStatus),
    answer: parse(q.answer),
    attemptCount: p?.attemptCount ?? 0,
    correctCount: p?.correctCount ?? 0,
    wrongCount: p?.wrongCount ?? 0,
    streak: p?.streak ?? 0,
    lastWrongAt: p?.lastWrongAt ?? null,
    nextReviewAt: p?.nextReviewAt ?? null,
    masteryScore: p?.masteryScore ?? 0,
    bookmarked: p?.bookmarked ?? false,
    memo: p?.memo ?? '',
    active: q.active,
  }));
}

/** 필터 UI를 채우기 위한 연도/회차 목록 */
export function availableYears(): { year: number; round: number | null }[] {
  return db
    .select({ year: questions.year, round: questions.round })
    .from(questions)
    .where(sql`${questions.year} is not null`)
    .groupBy(questions.year, questions.round)
    .orderBy(desc(questions.year), desc(questions.round))
    .all()
    .filter((r): r is { year: number; round: number | null } => r.year !== null);
}
