/** .env 로 바꿀 수 있는 시험 설정 */
export const examConfig = {
  examDate: process.env.EXAM_DATE ?? '2026-10-25',
  passScore: Number(process.env.PASS_SCORE ?? 60),
  questionCount: Number(process.env.EXAM_QUESTION_COUNT ?? 20),
  totalScore: Number(process.env.EXAM_TOTAL_SCORE ?? 100),
};

/**
 * 문항 수가 기본값과 달라도 100점 만점으로 환산한다.
 * (20문항이면 문항당 5점으로 기본 배점과 같다)
 */
export function scoreFor(correctCount: number, questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.round((correctCount / questionCount) * examConfig.totalScore);
}

/** 시험일까지 남은 일수 (오늘 기준, 음수면 이미 지남) */
export function daysUntilExam(today: Date = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = examConfig.examDate.split('-').map(Number);
  const exam = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Math.round((exam.getTime() - t.getTime()) / 86_400_000);
}

export interface ScoreSummary {
  count: number;
  average: number | null;
  recentAverage: number | null;
  best: number | null;
  worst: number | null;
  latest: number | null;
  /** 직전 회차 대비 변화 */
  delta: number | null;
  passCount: number;
  passRate: number | null;
}

/** 모의고사 점수 목록(오래된 것부터)을 요약한다. */
export function summarizeScores(scores: number[], recentWindow = 5): ScoreSummary {
  const avg = (nums: number[]): number | null =>
    nums.length === 0 ? null : Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;

  const passCount = scores.filter((s) => s >= examConfig.passScore).length;

  return {
    count: scores.length,
    average: avg(scores),
    recentAverage: avg(scores.slice(-recentWindow)),
    best: scores.length ? Math.max(...scores) : null,
    worst: scores.length ? Math.min(...scores) : null,
    latest: scores.length ? scores[scores.length - 1] : null,
    delta: scores.length >= 2 ? scores[scores.length - 1] - scores[scores.length - 2] : null,
    passCount,
    passRate: scores.length ? passCount / scores.length : null,
  };
}
