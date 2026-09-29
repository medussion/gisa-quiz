import { describe, expect, it } from 'vitest';
import {
  computeMastery,
  computeNextReview,
  nextInterval,
  priorityScore,
  type ProgressLike,
} from '../src/lib/scheduling';

const NOW = new Date('2026-09-22T09:00:00.000Z');

function progress(p: Partial<ProgressLike> = {}): ProgressLike {
  return {
    attemptCount: 1,
    correctCount: 1,
    wrongCount: 0,
    streak: 1,
    lastAnsweredAt: NOW.toISOString(),
    lastWrongAt: null,
    nextReviewAt: null,
    masteryScore: 0.5,
    ...p,
  };
}

describe('nextInterval', () => {
  it('streak가 쌓일수록 간격이 늘어난다', () => {
    expect(nextInterval(0)).toBe(0);
    expect(nextInterval(1)).toBe(1);
    expect(nextInterval(2)).toBe(3);
    expect(nextInterval(3)).toBe(7);
    expect(nextInterval(4)).toBe(14);
  });

  it('범위를 넘어도 최대 간격으로 잘린다', () => {
    expect(nextInterval(99)).toBe(30);
  });
});

describe('computeNextReview', () => {
  it('틀리면 당일 재출제 후보로 되돌린다', () => {
    expect(computeNextReview(0, false, NOW).getTime()).toBe(NOW.getTime());
  });

  it('맞히면 streak에 맞춰 뒤로 민다', () => {
    const due = computeNextReview(2, true, NOW);
    expect(Math.round((due.getTime() - NOW.getTime()) / 86_400_000)).toBe(3);
  });
});

describe('computeMastery', () => {
  it('풀지 않았으면 0이다', () => {
    expect(computeMastery(0, 0, 0)).toBe(0);
  });

  it('전부 맞히고 연속 정답이 쌓이면 1에 가깝다', () => {
    expect(computeMastery(5, 5, 5)).toBe(1);
  });

  it('정답률이 낮으면 낮게 나온다', () => {
    expect(computeMastery(1, 5, 0)).toBeLessThan(0.3);
  });
});

describe('priorityScore', () => {
  it('미풀이 문제가 이미 푼 문제보다 우선한다', () => {
    const unseen = priorityScore({ progress: null, sourceType: 'sample', difficulty: 3, now: NOW });
    const seen = priorityScore({ progress: progress({ streak: 2 }), sourceType: 'sample', difficulty: 3, now: NOW });
    expect(unseen).toBeGreaterThan(seen);
  });

  it('미풀이 기출이 미풀이 샘플보다 우선한다', () => {
    const past = priorityScore({ progress: null, sourceType: 'past_exam', difficulty: 3, now: NOW });
    const sample = priorityScore({ progress: null, sourceType: 'sample', difficulty: 3, now: NOW });
    expect(past).toBeGreaterThan(sample);
  });

  it('최근에 틀린 문제가 오래전에 틀린 문제보다 우선한다', () => {
    const recent = priorityScore({
      progress: progress({ wrongCount: 1, streak: 0, lastWrongAt: new Date(NOW.getTime() - 86_400_000).toISOString() }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    const old = priorityScore({
      progress: progress({ wrongCount: 1, streak: 0, lastWrongAt: new Date(NOW.getTime() - 60 * 86_400_000).toISOString() }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    expect(recent).toBeGreaterThan(old);
  });

  it('반복해서 틀린 문제가 한 번 틀린 문제보다 우선한다', () => {
    const many = priorityScore({ progress: progress({ wrongCount: 5, streak: 0 }), sourceType: 'sample', difficulty: 3, now: NOW });
    const once = priorityScore({ progress: progress({ wrongCount: 1, streak: 0 }), sourceType: 'sample', difficulty: 3, now: NOW });
    expect(many).toBeGreaterThan(once);
  });

  it('복습 주기가 도래하면 가점이 붙는다', () => {
    const due = priorityScore({
      progress: progress({ nextReviewAt: new Date(NOW.getTime() - 3600_000).toISOString() }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    const notDue = priorityScore({
      progress: progress({ nextReviewAt: new Date(NOW.getTime() + 7 * 86_400_000).toISOString() }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    expect(due).toBeGreaterThan(notDue);
  });

  it('연속 정답이 많은 문제가 가장 후순위다', () => {
    const mastered = priorityScore({
      progress: progress({ streak: 6, correctCount: 6, attemptCount: 6, masteryScore: 1 }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    const struggling = priorityScore({
      progress: progress({ streak: 0, wrongCount: 2, correctCount: 0, attemptCount: 2, masteryScore: 0 }),
      sourceType: 'sample',
      difficulty: 3,
      now: NOW,
    });
    expect(struggling).toBeGreaterThan(mastered);
  });
});
