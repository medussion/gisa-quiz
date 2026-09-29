import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, questionProgress, questions } from '@/db/schema';
import { gradeAnswer, type GradeResult } from '@/lib/grading';
import { computeMastery, computeNextReview } from '@/lib/scheduling';
import type { GradeResponse } from '@/lib/types';
import { toRevealed, type QuestionRow } from './questions';

function parse(value: string | null): string[] {
  if (!value) return [];
  try {
    const p = JSON.parse(value);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export function gradeFor(q: QuestionRow, userAnswer: string): GradeResult {
  return gradeAnswer(userAnswer, {
    questionType: q.questionType,
    answer: parse(q.answer),
    acceptedAnswers: parse(q.acceptedAnswers),
    caseSensitive: q.caseSensitive,
    orderSensitive: q.orderSensitive,
  });
}

/** 진도(progress)를 갱신한다. 시험 모드에서 나중에 일괄 반영할 때도 쓴다. */
export function applyProgress(questionId: string, isCorrect: boolean, now = new Date()) {
  const prev =
    db.select().from(questionProgress).where(eq(questionProgress.questionId, questionId)).get() ??
    null;

  const base = prev ?? {
    questionId,
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    lastAnsweredAt: null,
    lastCorrectAt: null,
    lastWrongAt: null,
    nextReviewAt: null,
    masteryScore: 0,
    bookmarked: false,
    memo: '',
  };

  const attemptCount = base.attemptCount + 1;
  const correctCount = base.correctCount + (isCorrect ? 1 : 0);
  const wrongCount = base.wrongCount + (isCorrect ? 0 : 1);
  const streak = isCorrect ? base.streak + 1 : 0;
  const iso = now.toISOString();

  const next = {
    attemptCount,
    correctCount,
    wrongCount,
    streak,
    lastAnsweredAt: iso,
    lastCorrectAt: isCorrect ? iso : base.lastCorrectAt,
    lastWrongAt: isCorrect ? base.lastWrongAt : iso,
    nextReviewAt: computeNextReview(streak, isCorrect, now).toISOString(),
    masteryScore: computeMastery(correctCount, attemptCount, streak),
  };

  if (prev) {
    db.update(questionProgress).set(next).where(eq(questionProgress.questionId, questionId)).run();
    return { ...prev, ...next };
  }
  const row = { questionId, ...next, bookmarked: false, memo: '' };
  db.insert(questionProgress).values(row).run();
  return row;
}

/** 이미 반영된 채점 결과를 뒤집는다 (SQL 등 수동 보정). */
function reverseProgress(questionId: string, wasCorrect: boolean, nowCorrect: boolean, now = new Date()) {
  const prev = db.select().from(questionProgress).where(eq(questionProgress.questionId, questionId)).get();
  if (!prev || wasCorrect === nowCorrect) return prev ?? null;

  const correctCount = Math.max(0, prev.correctCount + (nowCorrect ? 1 : -1));
  const wrongCount = Math.max(0, prev.wrongCount + (nowCorrect ? -1 : 1));
  const streak = nowCorrect ? prev.streak + 1 : 0;
  const iso = now.toISOString();

  const next = {
    correctCount,
    wrongCount,
    streak,
    lastCorrectAt: nowCorrect ? iso : prev.lastCorrectAt,
    lastWrongAt: nowCorrect ? prev.lastWrongAt : iso,
    nextReviewAt: computeNextReview(streak, nowCorrect, now).toISOString(),
    masteryScore: computeMastery(correctCount, prev.attemptCount, streak),
  };
  db.update(questionProgress).set(next).where(eq(questionProgress.questionId, questionId)).run();
  return { ...prev, ...next };
}

export interface SubmitInput {
  questionId: string;
  userAnswer: string;
  mode: string;
  durationMs?: number;
  examSessionId?: number | null;
  /** 모의고사처럼 진도 반영을 나중에 하고 싶을 때 false */
  updateProgress?: boolean;
  /** 풀지 않고 정답을 열어본 경우. 무조건 오답으로 기록한다. */
  reveal?: boolean;
  /** 힌트를 보고 풀었는지 */
  usedHint?: boolean;
}

export function submitAnswer(input: SubmitInput): GradeResponse | null {
  const q = db.select().from(questions).where(eq(questions.id, input.questionId)).get();
  if (!q) return null;

  const graded = gradeFor(q, input.userAnswer);
  // 정답을 열어본 경우에는 채점 결과와 상관없이 오답으로 남겨 다시 만나게 한다.
  const result: GradeResult = input.reveal
    ? { isCorrect: false, score: 0, perSlot: graded.perSlot.map(() => false), needsManualCheck: false }
    : graded;
  const now = new Date();

  const inserted = db
    .insert(attempts)
    .values({
      questionId: q.id,
      userAnswer: input.userAnswer,
      isCorrect: result.isCorrect,
      score: result.score,
      mode: input.mode,
      examSessionId: input.examSessionId ?? null,
      revealed: input.reveal ?? false,
      usedHint: input.usedHint ?? false,
      answeredAt: now.toISOString(),
      durationMs: input.durationMs ?? 0,
    })
    .returning({ id: attempts.id })
    .get();

  const progress =
    input.updateProgress === false
      ? db.select().from(questionProgress).where(eq(questionProgress.questionId, q.id)).get()
      : applyProgress(q.id, result.isCorrect, now);

  return {
    attemptId: inserted.id,
    isCorrect: result.isCorrect,
    score: result.score,
    perSlot: result.perSlot,
    needsManualCheck: result.needsManualCheck,
    wasRevealed: input.reveal ?? false,
    revealed: toRevealed(q),
    progress: {
      attemptCount: progress?.attemptCount ?? 0,
      correctCount: progress?.correctCount ?? 0,
      wrongCount: progress?.wrongCount ?? 0,
      streak: progress?.streak ?? 0,
      nextReviewAt: progress?.nextReviewAt ?? null,
      masteryScore: progress?.masteryScore ?? 0,
      bookmarked: progress?.bookmarked ?? false,
      memo: progress?.memo ?? '',
    },
  };
}

/**
 * SQL 문제처럼 자동 채점이 애매할 때 사용자가 정/오답을 직접 고친다.
 * 모의고사도 제출 시점에 진도를 반영하므로 여기서 함께 되돌린다.
 */
export function overrideAttempt(attemptId: number, isCorrect: boolean) {
  const a = db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
  if (!a) return null;

  // 이미 같은 값이면 기록은 그대로 두고 현재 진도만 돌려준다.
  const changed = a.isCorrect !== isCorrect;
  if (changed) {
    db.update(attempts)
      .set({ isCorrect, score: isCorrect ? 1 : 0, manualOverride: true })
      .where(eq(attempts.id, attemptId))
      .run();
  }

  const progress = changed
    ? reverseProgress(a.questionId, a.isCorrect, isCorrect)
    : db.select().from(questionProgress).where(eq(questionProgress.questionId, a.questionId)).get() ?? null;

  return {
    attempt: { ...a, isCorrect, score: isCorrect ? 1 : 0, manualOverride: changed || a.manualOverride },
    progress: {
      attemptCount: progress?.attemptCount ?? 0,
      correctCount: progress?.correctCount ?? 0,
      wrongCount: progress?.wrongCount ?? 0,
      streak: progress?.streak ?? 0,
      nextReviewAt: progress?.nextReviewAt ?? null,
      masteryScore: progress?.masteryScore ?? 0,
      bookmarked: progress?.bookmarked ?? false,
      memo: progress?.memo ?? '',
    },
  };
}

export function getAttemptHistory(questionId: string, limit = 20) {
  return db
    .select()
    .from(attempts)
    .where(eq(attempts.questionId, questionId))
    .orderBy(attempts.answeredAt)
    .all()
    .slice(-limit)
    .reverse();
}

export function setBookmark(questionId: string, bookmarked: boolean) {
  const exists = db.select().from(questionProgress).where(eq(questionProgress.questionId, questionId)).get();
  if (exists) {
    db.update(questionProgress).set({ bookmarked }).where(eq(questionProgress.questionId, questionId)).run();
  } else {
    db.insert(questionProgress).values({ questionId, bookmarked }).run();
  }
  return bookmarked;
}

export function setMemo(questionId: string, memo: string) {
  const exists = db.select().from(questionProgress).where(eq(questionProgress.questionId, questionId)).get();
  if (exists) {
    db.update(questionProgress).set({ memo }).where(eq(questionProgress.questionId, questionId)).run();
  } else {
    db.insert(questionProgress).values({ questionId, memo }).run();
  }
  return memo;
}
