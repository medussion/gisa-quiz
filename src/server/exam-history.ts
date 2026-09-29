import 'server-only';
import { asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, examSessions, questions } from '@/db/schema';
import { examConfig, summarizeScores } from '@/lib/config';
import { CATEGORY_LABELS } from '@/lib/constants';

export interface ExamRun {
  id: number;
  /** 몇 번째 회차인지 (오래된 것부터 1) */
  seq: number;
  startedAt: string;
  completedAt: string;
  questionCount: number;
  correctCount: number;
  score: number;
  passed: boolean;
  durationMs: number;
}

export interface ExamCategoryAverage {
  category: string;
  label: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface ExamHistory {
  runs: ExamRun[];
  /** 종합 평균 (모든 회차) */
  averageScore: number | null;
  /** 최근 5회 평균 */
  recentAverageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  latestScore: number | null;
  /** 직전 회차 대비 점수 변화 */
  delta: number | null;
  passCount: number;
  passRate: number | null;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number | null;
  passScore: number;
  /** 모의고사에서만 집계한 영역별 평균 */
  byCategory: ExamCategoryAverage[];
}

export function getExamHistory(): ExamHistory {
  const sessions = db
    .select()
    .from(examSessions)
    .where(isNotNull(examSessions.completedAt))
    .orderBy(asc(examSessions.completedAt))
    .all();

  const durations = db
    .select({
      sessionId: attempts.examSessionId,
      total: sql<number>`sum(${attempts.durationMs})`,
    })
    .from(attempts)
    .where(isNotNull(attempts.examSessionId))
    .groupBy(attempts.examSessionId)
    .all();
  const durationBySession = new Map(durations.map((d) => [d.sessionId, d.total ?? 0]));

  const runs: ExamRun[] = sessions.map((s, i) => ({
    id: s.id,
    seq: i + 1,
    startedAt: s.startedAt,
    completedAt: s.completedAt ?? s.startedAt,
    questionCount: s.questionCount,
    correctCount: s.correctCount,
    score: s.score,
    passed: s.score >= examConfig.passScore,
    durationMs: durationBySession.get(s.id) ?? 0,
  }));

  const summary = summarizeScores(runs.map((r) => r.score));
  const totalQuestions = runs.reduce((a, r) => a + r.questionCount, 0);
  const totalCorrect = runs.reduce((a, r) => a + r.correctCount, 0);

  // 모의고사 답안만 모아 영역별로 집계한다.
  const catRows = db
    .select({
      category: questions.category,
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
    })
    .from(attempts)
    .innerJoin(questions, eq(attempts.questionId, questions.id))
    .where(eq(attempts.mode, 'mock_exam'))
    .groupBy(questions.category)
    .all();

  const byCategory: ExamCategoryAverage[] = catRows
    .map((r) => ({
      category: r.category,
      label: CATEGORY_LABELS[r.category] ?? r.category,
      total: r.total,
      correct: r.correct ?? 0,
      accuracy: r.total > 0 ? (r.correct ?? 0) / r.total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    runs: [...runs].reverse(), // 화면에는 최신순으로 보여준다
    averageScore: summary.average,
    recentAverageScore: summary.recentAverage,
    bestScore: summary.best,
    worstScore: summary.worst,
    latestScore: summary.latest,
    delta: summary.delta,
    passCount: summary.passCount,
    passRate: summary.passRate,
    totalQuestions,
    totalCorrect,
    overallAccuracy: totalQuestions ? totalCorrect / totalQuestions : null,
    passScore: examConfig.passScore,
    byCategory,
  };
}

export interface PastRoundStat {
  year: number;
  round: number;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number | null;
}

/** 실제 기출 연도·회차별 정답률 (기출 문제를 import 했을 때만 채워진다) */
export function getPastRoundStats(): PastRoundStat[] {
  const rows = db
    .select({
      year: questions.year,
      round: questions.round,
      total: sql<number>`count(distinct ${questions.id})`,
      attempted: sql<number>`count(${attempts.id})`,
      correct: sql<number>`sum(case when ${attempts.isCorrect} then 1 else 0 end)`,
    })
    .from(questions)
    .leftJoin(attempts, eq(questions.id, attempts.questionId))
    .where(sql`${questions.sourceType} = 'past_exam' and ${questions.year} is not null and ${questions.round} is not null`)
    .groupBy(questions.year, questions.round)
    .orderBy(desc(questions.year), desc(questions.round))
    .all();

  return rows
    .filter((r): r is { year: number; round: number; total: number; attempted: number; correct: number } =>
      r.year !== null && r.round !== null,
    )
    .map((r) => ({
      year: r.year,
      round: r.round,
      total: r.total,
      attempted: r.attempted ?? 0,
      correct: r.correct ?? 0,
      accuracy: (r.attempted ?? 0) > 0 ? (r.correct ?? 0) / (r.attempted ?? 1) : null,
    }));
}
