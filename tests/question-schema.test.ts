import { describe, expect, it } from 'vitest';
import { validateQuestions } from '../src/lib/question-schema';

const ok = {
  id: 'q-001',
  sourceType: 'past_exam',
  sourceLabel: '2024년 2회 실기 복원',
  sourceUrls: ['https://example.com/a'],
  year: 2024,
  round: 2,
  category: 'sql',
  questionType: 'sql',
  question: '학생 테이블에서 이름을 조회하는 SQL문을 작성하시오.',
  answer: ['SELECT NAME FROM STUDENT;'],
  explanation: '기본 SELECT문이다.',
  verificationStatus: 'cross_checked',
};

describe('validateQuestions', () => {
  it('정상 데이터를 통과시킨다', () => {
    const r = validateQuestions([ok]);
    expect(r.valid).toHaveLength(1);
    expect(r.issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });

  it('배열이 아니면 오류를 낸다', () => {
    const r = validateQuestions({ id: 'x' });
    expect(r.issues[0].level).toBe('error');
    expect(r.valid).toHaveLength(0);
  });

  it('id 중복을 잡는다', () => {
    const r = validateQuestions([ok, { ...ok }]);
    expect(r.issues.some((i) => i.message.includes('중복'))).toBe(true);
    expect(r.valid).toHaveLength(1);
  });

  it('answer가 비면 거절한다', () => {
    const r = validateQuestions([{ ...ok, answer: [] }]);
    expect(r.valid).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
  });

  it('question이 비면 거절한다', () => {
    const r = validateQuestions([{ ...ok, question: '   ' }]);
    expect(r.valid).toHaveLength(0);
  });

  it('알 수 없는 category를 거절한다', () => {
    const r = validateQuestions([{ ...ok, category: 'not_a_category' }]);
    expect(r.valid).toHaveLength(0);
  });

  it('알 수 없는 questionType을 거절한다', () => {
    const r = validateQuestions([{ ...ok, questionType: 'essay' }]);
    expect(r.valid).toHaveLength(0);
  });

  it('객관식인데 choices가 없으면 거절한다', () => {
    const r = validateQuestions([{ ...ok, questionType: 'multiple_choice', choices: undefined }]);
    expect(r.valid).toHaveLength(0);
  });

  it('generated인데 basedOn이 없으면 경고한다', () => {
    const r = validateQuestions([{ ...ok, sourceType: 'generated', basedOn: undefined }]);
    expect(r.valid).toHaveLength(1);
    expect(r.issues.some((i) => i.level === 'warn' && i.message.includes('basedOn'))).toBe(true);
  });

  it('past_exam인데 year/round가 없으면 경고한다', () => {
    const r = validateQuestions([{ ...ok, year: undefined, round: undefined }]);
    expect(r.valid).toHaveLength(1);
    expect(r.issues.some((i) => i.level === 'warn' && i.message.includes('year/round'))).toBe(true);
  });

  it('기본값을 채워 넣는다', () => {
    const r = validateQuestions([
      { id: 'q-2', sourceType: 'sample', category: 'sql', questionType: 'term', question: 'x', answer: ['y'] },
    ]);
    expect(r.valid[0].difficulty).toBe(3);
    expect(r.valid[0].acceptedAnswers).toEqual([]);
    expect(r.valid[0].verificationStatus).toBe('unverified');
    expect(r.valid[0].active).toBe(true);
  });

  it('past_exam의 기본 검증 상태는 single_source다', () => {
    const r = validateQuestions([{ ...ok, verificationStatus: undefined }]);
    expect(r.valid[0].verificationStatus).toBe('single_source');
  });
});
