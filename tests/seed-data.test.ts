import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradeAnswer, normalizeForCompare } from '../src/lib/grading';
import { buildHint } from '../src/lib/hints';
import { validateQuestions, type RawQuestion } from '../src/lib/question-schema';

const raw = JSON.parse(fs.readFileSync('data/normalized/questions.json', 'utf8'));
const result = validateQuestions(raw);

describe('seed dataset', () => {
  it('오류 없이 검증을 통과한다', () => {
    const errors = result.issues.filter((i) => i.level === 'error');
    expect(errors).toEqual([]);
  });

  it('경고 없이 검증을 통과한다', () => {
    const warns = result.issues.filter((i) => i.level === 'warn');
    expect(warns).toEqual([]);
  });

  it('문제가 비어 있지 않다', () => {
    expect(result.valid.length).toBeGreaterThan(0);
  });

  /**
   * 샘플 문제를 실제 기출이라고 표시해서는 안 된다.
   * 기출로 들어오는 문제는 반드시 출처 URL과 연도/회차를 갖는다.
   */
  it('기출로 표시된 문제는 출처와 연도/회차를 갖는다', () => {
    for (const q of result.valid as RawQuestion[]) {
      if (q.sourceType !== 'past_exam') continue;
      expect(q.year, `${q.id}: year`).toBeTruthy();
      expect(q.round, `${q.id}: round`).toBeTruthy();
      expect((q.sourceUrls ?? []).length, `${q.id}: sourceUrls`).toBeGreaterThan(0);
    }
  });

  it('모든 문제에 해설이 있다', () => {
    for (const q of result.valid) {
      expect((q.explanation ?? '').length, `${q.id}: explanation`).toBeGreaterThan(0);
    }
  });

  it('자기 자신의 정답으로 채점하면 모두 정답이 된다', () => {
    for (const q of result.valid as RawQuestion[]) {
      const given = q.answer.join('\n');
      const r = gradeAnswer(given, {
        questionType: q.questionType,
        answer: q.answer,
        acceptedAnswers: q.acceptedAnswers ?? [],
        caseSensitive: q.caseSensitive ?? false,
        orderSensitive: q.orderSensitive ?? false,
      });
      expect(r.isCorrect, `${q.id}: ${given}`).toBe(true);
    }
  });

  it('acceptedAnswers도 정답으로 채점된다 (빈칸이 하나인 문제)', () => {
    for (const q of result.valid as RawQuestion[]) {
      if (q.answer.length !== 1) continue;
      for (const alt of q.acceptedAnswers ?? []) {
        const r = gradeAnswer(alt, {
          questionType: q.questionType,
          answer: q.answer,
          acceptedAnswers: q.acceptedAnswers ?? [],
          caseSensitive: q.caseSensitive ?? false,
          orderSensitive: q.orderSensitive ?? false,
        });
        expect(r.isCorrect, `${q.id}: ${alt}`).toBe(true);
      }
    }
  });

  it('직접 적은 힌트가 정답을 그대로 노출하지 않는다', () => {
    for (const q of result.valid as RawQuestion[]) {
      const hint = (q.hint ?? '').trim();
      if (!hint) continue;
      const normalizedHint = normalizeForCompare(hint);
      for (const a of q.answer) {
        // 2글자 이상인 정답이 힌트 안에 통째로 들어 있으면 힌트가 아니라 답이다
        if (a.replace(/\s+/g, '').length < 2) continue;
        expect(normalizedHint.includes(normalizeForCompare(a)), `${q.id}: "${a}"`).toBe(false);
      }
    }
  });

  it('모든 문제에서 힌트를 만들 수 있다', () => {
    for (const q of result.valid as RawQuestion[]) {
      const h = buildHint({
        questionType: q.questionType,
        answer: q.answer,
        hint: q.hint,
        subcategory: q.subcategory,
      });
      expect(h.text.length, q.id).toBeGreaterThan(0);
    }
  });
});
