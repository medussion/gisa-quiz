import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeForCompare } from '../src/lib/grading';
import { validateQuestions, type RawQuestion } from '../src/lib/question-schema';

const files = fs.readdirSync('data/normalized').filter((f) => f.startsWith('past-'));
const past = files.flatMap(
  (f) => validateQuestions(JSON.parse(fs.readFileSync(`data/normalized/${f}`, 'utf8'))).valid,
) as RawQuestion[];

describe('기출 해설', () => {
  it('수집한 기출이 모두 검증을 통과한다', () => {
    expect(past.length).toBeGreaterThan(300);
  });

  it('모든 기출 문항에 해설이 있다', () => {
    const missing = past.filter((q) => !q.explanation?.trim()).map((q) => q.id);
    expect(missing).toEqual([]);
  });

  it('해설이 정답만 덜렁 적어 놓은 수준은 아니다', () => {
    const tooShort = past.filter((q) => (q.explanation ?? '').trim().length < 30).map((q) => q.id);
    expect(tooShort).toEqual([]);
  });

  it('해설 파일과 문항 id가 어긋나지 않는다', () => {
    const doc = JSON.parse(fs.readFileSync('data/explanations.json', 'utf8')) as {
      explanations: Record<string, string>;
    };
    const ids = new Set(past.map((q) => q.id));
    const orphan = Object.keys(doc.explanations).filter((id) => !ids.has(id));
    expect(orphan).toEqual([]);
  });

  it('보정에는 반드시 근거가 적혀 있다', () => {
    const doc = JSON.parse(fs.readFileSync('data/corrections.json', 'utf8')) as {
      corrections: { id: string; reason: string }[];
    };
    const noReason = doc.corrections.filter((c) => !c.reason?.trim()).map((c) => c.id);
    expect(noReason).toEqual([]);
  });

  it('해설이 정답을 그대로 베껴 쓴 것이 아니다', () => {
    // 해설 전체가 정답 문자열과 똑같으면 설명이 아니다
    for (const q of past) {
      const ex = normalizeForCompare(q.explanation ?? '');
      expect(ex, q.id).not.toBe(normalizeForCompare(q.answer.join(' ')));
    }
  });
});
