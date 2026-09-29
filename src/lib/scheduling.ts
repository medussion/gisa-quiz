/**
 * 출제 우선순위 계산과 Spaced Repetition 주기.
 * 시험까지 기간이 짧으므로 공격적인 주기를 쓴다.
 */

export interface ProgressLike {
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  lastAnsweredAt: string | null;
  lastWrongAt: string | null;
  nextReviewAt: string | null;
  masteryScore: number;
}

/** 오답 이후 복습 간격(일). streak가 쌓일수록 길어진다. */
export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];

export function nextInterval(streak: number): number {
  const idx = Math.min(Math.max(streak, 0), REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[idx];
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function computeNextReview(streak: number, isCorrect: boolean, now: Date = new Date()): Date {
  // 틀리면 당일 재출제 후보로 되돌린다.
  if (!isCorrect) return now;
  return addDays(now, nextInterval(streak));
}

/** 0.0~1.0. 정답률과 연속 정답을 함께 본다. */
export function computeMastery(correctCount: number, attemptCount: number, streak: number): number {
  if (attemptCount === 0) return 0;
  const rate = correctCount / attemptCount;
  const streakBonus = Math.min(streak, 4) / 4;
  return Math.round(Math.min(1, rate * 0.7 + streakBonus * 0.3) * 1000) / 1000;
}

const W_WRONG = 12;
const W_STREAK = 8;
const UNSEEN_BONUS = 40;
const UNSEEN_PAST_EXAM_BONUS = 15;
const RECENT_WRONG_BONUS = 30;
const REVIEW_DUE_BONUS = 25;
const STALE_CORRECT_BONUS = 10;

export interface PriorityInput {
  progress: ProgressLike | null;
  sourceType: string;
  difficulty: number;
  now?: Date;
}

/**
 * 우선순위:
 * 1. 미풀이 기출 2. 최근 오답 3. 반복 오답 4. 복습 도래
 * 5. 오래전에 맞힌 문제 6. 최근 연속 정답 문제(가장 후순위)
 */
export function priorityScore({ progress, sourceType, difficulty, now = new Date() }: PriorityInput): number {
  let score = 0;

  if (!progress || progress.attemptCount === 0) {
    score += UNSEEN_BONUS;
    if (sourceType === 'past_exam') score += UNSEEN_PAST_EXAM_BONUS;
    return score + difficulty;
  }

  score += progress.wrongCount * W_WRONG;
  score -= progress.streak * W_STREAK;

  const daysSince = (iso: string | null) =>
    iso ? (now.getTime() - new Date(iso).getTime()) / 86_400_000 : Number.POSITIVE_INFINITY;

  const sinceWrong = daysSince(progress.lastWrongAt);
  if (sinceWrong <= 7) score += RECENT_WRONG_BONUS * (1 - sinceWrong / 7);

  if (progress.nextReviewAt) {
    const due = new Date(progress.nextReviewAt).getTime();
    if (due <= now.getTime()) score += REVIEW_DUE_BONUS;
  }

  const sinceAnswered = daysSince(progress.lastAnsweredAt);
  if (Number.isFinite(sinceAnswered) && sinceAnswered > 7) {
    score += Math.min(STALE_CORRECT_BONUS, (sinceAnswered - 7) * 1.5);
  }

  score += (1 - progress.masteryScore) * 10;
  score += difficulty;
  return Math.round(score * 100) / 100;
}
