import { describe, expect, it } from 'vitest';
import { buildHint, type HintSource } from '../src/lib/hints';

const base: HintSource = {
  questionType: 'short_answer',
  answer: ['폭포수 모델'],
};

describe('buildHint - 직접 적은 힌트', () => {
  it('hint가 있으면 그대로 쓴다', () => {
    const h = buildHint({ ...base, hint: '단계를 거꾸로 못 올라갑니다.' });
    expect(h.text).toBe('단계를 거꾸로 못 올라갑니다.');
    expect(h.auto).toBe(false);
  });

  it('hint가 공백뿐이면 자동 생성으로 넘어간다', () => {
    expect(buildHint({ ...base, hint: '   ' }).auto).toBe(true);
  });
});

describe('buildHint - 자동 생성', () => {
  it('한글 정답은 글자 수와 첫 글자를 알려준다', () => {
    const h = buildHint(base);
    expect(h.auto).toBe(true);
    expect(h.text).toContain('5글자');
    expect(h.text).toContain('「폭」');
  });

  it('정답 전체를 흘리지 않는다', () => {
    expect(buildHint(base).text).not.toContain('폭포수 모델');
  });

  it('1글자 정답은 첫 글자를 공개하지 않는다', () => {
    const h = buildHint({ ...base, answer: ['큐'] });
    expect(h.text).toContain('1글자');
    expect(h.text).not.toContain('「큐」');
  });

  it('숫자 정답은 자릿수만 알려준다', () => {
    const h = buildHint({ questionType: 'code_output', answer: ['120'] });
    expect(h.text).toContain('3자리 숫자');
    expect(h.text).not.toContain('120');
  });

  it('음수도 부호를 알려준다', () => {
    expect(buildHint({ questionType: 'code_output', answer: ['-5'] }).text).toContain('음수');
  });

  it('영문 정답은 영문이라고 알려준다', () => {
    const h = buildHint({ questionType: 'term', answer: ['DISTINCT'] });
    expect(h.text).toContain('영문');
    expect(h.text).toContain('8글자');
    expect(h.text).toContain('「D」');
  });

  it('SQL은 첫 키워드를 알려준다', () => {
    const h = buildHint({ questionType: 'sql', answer: ['select name from student;'] });
    expect(h.text).toContain('SELECT');
    expect(h.text).not.toContain('student');
  });

  it('빈칸이 여러 개면 개수와 각 칸을 설명한다', () => {
    const h = buildHint({ questionType: 'short_answer', answer: ['스택', '드라이버'] });
    expect(h.text).toContain('빈칸 2개');
    expect(h.text).toContain('(1)');
    expect(h.text).toContain('(2)');
    expect(h.text).toContain('「드」');
  });

  it('객관식은 정답 번호를 알려주지 않는다', () => {
    const h = buildHint({ questionType: 'multiple_choice', answer: ['3'] });
    expect(h.text).toContain('보기 중 하나');
    expect(h.text).not.toContain('3자리');
  });

  it('세부 분류가 있으면 앞에 붙인다', () => {
    const h = buildHint({ ...base, subcategory: '소프트웨어 생명주기' });
    expect(h.text).toContain('분야: 소프트웨어 생명주기');
  });

  it('정답이 비어 있어도 터지지 않는다', () => {
    expect(() => buildHint({ questionType: 'term', answer: [] })).not.toThrow();
    expect(buildHint({ questionType: 'term', answer: [] }).text.length).toBeGreaterThan(0);
  });

  it('공백은 글자 수에서 뺀다', () => {
    // "제3정규형" 5글자
    expect(buildHint({ questionType: 'term', answer: ['제 3 정규형'] }).text).toContain('5글자');
  });
});
