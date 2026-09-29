import { describe, expect, it } from 'vitest';
import { parseQuestionInput } from '../src/lib/question-input';
import { validateQuestions } from '../src/lib/question-schema';

describe('parseQuestionInput', () => {
  it('여러 줄 입력을 배열로 바꾸고 빈 줄을 버린다', () => {
    const r = parseQuestionInput({ answer: '큐\n\n  스택  \n' });
    expect(r.answer).toEqual(['큐', '스택']);
  });

  it('빈 문자열은 null로 바꾼다', () => {
    const r = parseQuestionInput({ code: '   ', subcategory: '', hint: '' });
    expect(r.code).toBeNull();
    expect(r.subcategory).toBeNull();
    expect(r.hint).toBeNull();
  });

  it('숫자 칸이 비면 null이다', () => {
    const r = parseQuestionInput({ year: '', round: '  ' });
    expect(r.year).toBeNull();
    expect(r.round).toBeNull();
  });

  it('연도·회차를 숫자로 바꾼다', () => {
    const r = parseQuestionInput({ year: '2024', round: '2' });
    expect(r.year).toBe(2024);
    expect(r.round).toBe(2);
  });

  it('난이도가 없으면 3으로 둔다', () => {
    expect(parseQuestionInput({}).difficulty).toBe(3);
  });

  it('보기가 없으면 choices는 null이다', () => {
    expect(parseQuestionInput({ choices: '' }).choices).toBeNull();
    expect(parseQuestionInput({ choices: 'A\nB' }).choices).toEqual(['A', 'B']);
  });

  it('active를 안 보내면 출제 대상으로 둔다', () => {
    expect(parseQuestionInput({}).active).toBe(true);
    expect(parseQuestionInput({ active: false }).active).toBe(false);
  });

  it('id가 비면 undefined로 둬서 자동 생성되게 한다', () => {
    expect(parseQuestionInput({ id: '  ' }).id).toBeUndefined();
    expect(parseQuestionInput({ id: ' user-1 ' }).id).toBe('user-1');
  });

  it('폼에서 온 값이 그대로 검증을 통과한다', () => {
    const parsed = parseQuestionInput({
      sourceType: 'user',
      category: 'sql',
      questionType: 'sql',
      question: '학생 테이블에서 이름을 조회하는 SQL문을 작성하시오.',
      answer: 'SELECT NAME FROM STUDENT;',
      explanation: '기본 SELECT문이다.',
      id: 'user-9999',
    });
    const res = validateQuestions([parsed]);
    expect(res.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(res.valid).toHaveLength(1);
  });

  it('필수 값이 비면 검증에서 걸린다', () => {
    const parsed = parseQuestionInput({ id: 'x', sourceType: 'user', category: 'sql', questionType: 'sql' });
    const res = validateQuestions([parsed]);
    expect(res.issues.some((i) => i.level === 'error')).toBe(true);
  });
});
