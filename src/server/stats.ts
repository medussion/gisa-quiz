import 'server-only';
import { desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, examSessions, questionProgress, questions } from '@/db/schema';
import { CATEGORY_LABELS } from '@/lib/constants';

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface CategoryStat {
  category: string;
  label: string;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
}

export interface DashboardData {
  totalQuestions: number;
  unseenCount: number;
  todaySolved: number;
  todayCorrect: number;
  todayAccuracy: number | null;
  overallAttempts: number;
  overallAccuracy: number | null;
  wrongPoolSize: number;
  reviewDueCount: number;
  bookmarkedCount: number;
  categoryStats: CategoryStat[];
  weakCategories: CategoryStat[];
  last7Days: { date: string; label: string; solved: number; correct: number }[];
  recentExams: { id: number; completedAt: string | null; score: number; correctCount: number; questionCount: number }[];
  /** 완료한 모의고사 전체 평균 점수 */
  examCount: number;
  examAverageScore: number | null;
  sourceBreakdown: { sourceType: string; n: number }[];
}

export function getDashboard(now = new Date()): DashboardData {
  const totalQuestions =
    db.select({ n: sql<number>`count(*)` }).from(questions).where(eq(questions.active, true)).get()?.n ?? 0;

  const unseenCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(questions)
      .leftJoin(questionProgress, eq(questions.id, questionProgress.questionId))
      .where(sql`${questions.active} = 1 AND coalesce(${questionProgress.attemptCount}, 0) = 0`)
      .get()?.n ?? 0;

  // 최근 8일치만 가져와 로컬 날짜 기준으로 묶는다.
  const since = new Date(now.getTime() - 8 * 86_400_000).toISOString();
  const recentAttempts = db
    .select({ answeredAt: attempts.answeredAt, isCorrect: attempts.isCorrect })
    .from(attempts)
    .where(gte(attempts.answeredAt, since))
    .all();

  const byDay = new Map<string, { solved: number; correct: number }>();
  for (const a of recentAttempts) {
    const key = localDateKey(a.answeredAt);
    const cur = byDay.get(key) ?? { solved: 0, correct: 0 };
    cur.solved += 1;
    if (a.isCorrect) cur.correct += 1;
    byDay.set(key, cur);
  }

  const last7Days: DashboardData['last7Days'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = todayKey(d);
    const v = byDay.get(key) ?? { solved: 0, correct: 0 };
    last7Days.push({
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      solved: v.solved,
      correct: v.correct,
    });
  }

  const today = byDay.get(todayKey(now)) ?? { solved: 0, correct: 0 };

  const overall = db
    .select({
      n: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
    })
    .from(attempts)
    .get();
  const overallAttempts = overall?.n ?? 0;
  const overallCorrect = overall?.correct ?? 0;

  const catRows = db
    .select({
      category: questions.category,
      total: sql<number>`count(distinct ${questions.id})`,
      attempted: sql<number>`sum(case when coalesce(${questionProgress.attemptCount},0) > 0 then 1 else 0 end)`,
      correctCount: sql<number>`sum(coalesce(${questionProgress.correctCount},0))`,
      attemptCount: sql<number>`sum(coalesce(${questionProgress.attemptCount},0))`,
    })
    .from(questions)
    .leftJoin(questionProgress, eq(questions.id, questionProgress.questionId))
    .where(eq(questions.active, true))
    .groupBy(questions.category)
    .all();

  const categoryStats: CategoryStat[] = catRows
    .map((r) => ({
      category: r.category,
      label: CATEGORY_LABELS[r.category] ?? r.category,
      total: r.total,
      attempted: r.attempted ?? 0,
      correct: r.correctCount ?? 0,
      accuracy: (r.attemptCount ?? 0) > 0 ? (r.correctCount ?? 0) / (r.attemptCount ?? 1) : null,
    }))
    .sort((a, b) => b.total - a.total);

  const weakCategories = categoryStats
    .filter((c) => c.accuracy !== null && c.attempted >= 1)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 4);

  const wrongPoolSize =
    db
      .select({ n: sql<number>`count(*)` })
      .from(questionProgress)
      .where(sql`${questionProgress.wrongCount} > 0`)
      .get()?.n ?? 0;

  const reviewDueCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(questionProgress)
      .where(sql`${questionProgress.nextReviewAt} is not null and ${questionProgress.nextReviewAt} <= ${now.toISOString()}`)
      .get()?.n ?? 0;

  const bookmarkedCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(questionProgress)
      .where(eq(questionProgress.bookmarked, true))
      .get()?.n ?? 0;

  const recentExams = db
    .select({
      id: examSessions.id,
      completedAt: examSessions.completedAt,
      score: examSessions.score,
      correctCount: examSessions.correctCount,
      questionCount: examSessions.questionCount,
    })
    .from(examSessions)
    .where(isNotNull(examSessions.completedAt))
    .orderBy(desc(examSessions.completedAt))
    .limit(5)
    .all();

  const examAgg = db
    .select({
      n: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${examSessions.score})`,
    })
    .from(examSessions)
    .where(isNotNull(examSessions.completedAt))
    .get();

  const sourceBreakdown = db
    .select({ sourceType: questions.sourceType, n: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.active, true))
    .groupBy(questions.sourceType)
    .all();

  return {
    totalQuestions,
    unseenCount,
    todaySolved: today.solved,
    todayCorrect: today.correct,
    todayAccuracy: today.solved > 0 ? today.correct / today.solved : null,
    overallAttempts,
    overallAccuracy: overallAttempts > 0 ? overallCorrect / overallAttempts : null,
    wrongPoolSize,
    reviewDueCount,
    bookmarkedCount,
    categoryStats,
    weakCategories,
    last7Days,
    recentExams,
    examCount: examAgg?.n ?? 0,
    examAverageScore: (examAgg?.n ?? 0) > 0 ? Math.round((examAgg?.avgScore ?? 0) * 10) / 10 : null,
    sourceBreakdown,
  };
}
