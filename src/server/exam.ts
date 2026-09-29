import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { attempts, examSessions } from '@/db/schema';
import { CATEGORY_LABELS } from '@/lib/constants';
import { examConfig, scoreFor } from '@/lib/config';
import { applyProgress, gradeFor } from './attempts';
import { getQuestionsByIds, selectQuestions, toDTO, toRevealed } from './questions';
import type { QuestionDTO, RevealedQuestion } from '@/lib/types';

export interface ExamStartResult {
  sessionId: number;
  questions: QuestionDTO[];
}

/** 모의고사 시작: 문제를 고정해 세션에 저장한다. */
export function startExam(count = examConfig.questionCount, pastOnly = false): ExamStartResult {
  const picked = selectQuestions({ mode: 'mock_exam', count, pastOnly });
  const ids = picked.map((q) => q.id);

  const row = db
    .insert(examSessions)
    .values({
      startedAt: new Date().toISOString(),
      questionCount: ids.length,
      mode: 'mock_exam',
      questionIds: JSON.stringify(ids),
    })
    .returning({ id: examSessions.id })
    .get();

  return { sessionId: row.id, questions: picked.map(toDTO) };
}

export interface ExamAnswerInput {
  questionId: string;
  userAnswer: string;
  durationMs?: number;
}

export interface ExamResultItem {
  question: RevealedQuestion;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  attemptId: number;
  needsManualCheck: boolean;
}

export interface ExamResult {
  sessionId: number;
  score: number;
  passScore: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  byCategory: { category: string; label: string; total: number; correct: number }[];
  items: ExamResultItem[];
}

/**
 * 모의고사 제출: 한 번에 채점하고 진도까지 반영한다.
 * 시험 중에는 정답을 공개하지 않으므로 제출 시점에만 결과를 만든다.
 */
export function submitExam(sessionId: number, answers: ExamAnswerInput[]): ExamResult | null {
  const session = db.select().from(examSessions).where(eq(examSessions.id, sessionId)).get();
  if (!session) return null;

  const ids: string[] = JSON.parse(session.questionIds || '[]');
  const questionRows = getQuestionsByIds(ids);
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));
  const now = new Date();

  const items: ExamResultItem[] = [];
  let correctCount = 0;

  db.transaction((tx) => {
    for (const q of questionRows) {
      const given = answerMap.get(q.id);
      const userAnswer = given?.userAnswer ?? '';
      const result = gradeFor(q, userAnswer);
      if (result.isCorrect) correctCount++;

      const inserted = tx
        .insert(attempts)
        .values({
          questionId: q.id,
          userAnswer,
          isCorrect: result.isCorrect,
          score: result.score,
          mode: 'mock_exam',
          examSessionId: sessionId,
          answeredAt: now.toISOString(),
          durationMs: given?.durationMs ?? 0,
        })
        .returning({ id: attempts.id })
        .get();

      items.push({
        question: toRevealed(q),
        userAnswer,
        isCorrect: result.isCorrect,
        score: result.score,
        attemptId: inserted.id,
        needsManualCheck: result.needsManualCheck,
      });
    }
  });

  // 진도 반영은 트랜잭션 밖에서(읽기/쓰기가 섞이므로) 순차 처리한다.
  for (const item of items) applyProgress(item.question.id, item.isCorrect, now);

  const score = scoreFor(correctCount, questionRows.length);

  db.update(examSessions)
    .set({
      completedAt: now.toISOString(),
      correctCount,
      score,
      questionCount: questionRows.length,
    })
    .where(eq(examSessions.id, sessionId))
    .run();

  const catMap = new Map<string, { total: number; correct: number }>();
  for (const item of items) {
    const c = catMap.get(item.question.category) ?? { total: 0, correct: 0 };
    c.total += 1;
    if (item.isCorrect) c.correct += 1;
    catMap.set(item.question.category, c);
  }

  return {
    sessionId,
    score,
    passScore: examConfig.passScore,
    passed: score >= examConfig.passScore,
    correctCount,
    questionCount: questionRows.length,
    byCategory: [...catMap.entries()]
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category] ?? category, ...v }))
      .sort((a, b) => b.total - a.total),
    items,
  };
}

/** 이미 제출한 모의고사 결과를 다시 보여준다. */
export function getExamResult(sessionId: number): ExamResult | null {
  const session = db.select().from(examSessions).where(eq(examSessions.id, sessionId)).get();
  if (!session || !session.completedAt) return null;

  const rows = db.select().from(attempts).where(eq(attempts.examSessionId, sessionId)).all();
  const ids: string[] = JSON.parse(session.questionIds || '[]');
  const questionRows = getQuestionsByIds(ids);
  const attemptByQuestion = new Map(rows.map((r) => [r.questionId, r]));

  const items: ExamResultItem[] = questionRows.map((q) => {
    const a = attemptByQuestion.get(q.id);
    return {
      question: toRevealed(q),
      userAnswer: a?.userAnswer ?? '',
      isCorrect: a?.isCorrect ?? false,
      score: a?.score ?? 0,
      attemptId: a?.id ?? 0,
      needsManualCheck: q.questionType === 'sql' || q.questionType === 'descriptive',
    };
  });

  const catMap = new Map<string, { total: number; correct: number }>();
  for (const item of items) {
    const c = catMap.get(item.question.category) ?? { total: 0, correct: 0 };
    c.total += 1;
    if (item.isCorrect) c.correct += 1;
    catMap.set(item.question.category, c);
  }

  const correctCount = items.filter((i) => i.isCorrect).length;
  const score = scoreFor(correctCount, questionRows.length);

  return {
    sessionId,
    score,
    passScore: examConfig.passScore,
    passed: score >= examConfig.passScore,
    correctCount,
    questionCount: items.length,
    byCategory: [...catMap.entries()]
      .map(([category, v]) => ({ category, label: CATEGORY_LABELS[category] ?? category, ...v }))
      .sort((a, b) => b.total - a.total),
    items,
  };
}
