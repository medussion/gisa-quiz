import { describe, expect, it } from 'vitest';
import {
  gradeAnswer,
  normalizeBasic,
  normalizeForCompare,
  normalizeForDedupe,
  normalizeSql,
  similarity,
  type GradableQuestion,
} from '../src/lib/grading';

const base: GradableQuestion = {
  questionType: 'short_answer',
  answer: ['폭포수 모델'],
  acceptedAnswers: ['Waterfall Model', '폭포수모델'],
  caseSensitive: false,
  orderSensitive: false,
};

describe('normalizeBasic', () => {
  it('앞뒤 공백과 연속 공백을 정리한다', () => {
    expect(normalizeBasic('  폭포수   모델  ')).toBe('폭포수 모델');
  });

  it('CRLF와 연속 줄바꿈을 정리한다', () => {
    expect(normalizeBasic('a\r\n\r\n\r\nb')).toBe('a\nb');
  });

  it('탭과 전각 공백도 공백으로 본다', () => {
    expect(normalizeBasic('a\t　b')).toBe('a b');
  });
});

describe('normalizeForCompare', () => {
  it('기본적으로 대소문자를 무시한다', () => {
    expect(normalizeForCompare('SQL')).toBe(normalizeForCompare('sql'));
  });

  it('caseSensitive면 대소문자를 구분한다', () => {
    expect(normalizeForCompare('SQL', { caseSensitive: true })).not.toBe(
      normalizeForCompare('sql', { caseSensitive: true }),
    );
  });

  it('끝에 붙은 마침표를 무시한다', () => {
    expect(normalizeForCompare('스택.')).toBe('스택');
  });
});

describe('normalizeSql', () => {
  it('줄바꿈, 후행 세미콜론, 대소문자를 정규화한다', () => {
    const a = 'SELECT NAME\nFROM STUDENT\nWHERE DEPT = \'컴퓨터\';';
    const b = "select name from student where dept = '컴퓨터'";
    expect(normalizeSql(a)).toBe(normalizeSql(b));
  });

  it('괄호 주변 공백을 정규화한다', () => {
    expect(normalizeSql('COUNT ( * )')).toBe(normalizeSql('count(*)'));
  });
});

describe('gradeAnswer - 단일 정답', () => {
  it('정답을 맞히면 정답 처리한다', () => {
    expect(gradeAnswer('폭포수 모델', base).isCorrect).toBe(true);
  });

  it('공백이 달라도 맞힌 것으로 본다', () => {
    expect(gradeAnswer('  폭포수   모델 ', base).isCorrect).toBe(true);
  });

  it('acceptedAnswers도 정답으로 본다', () => {
    expect(gradeAnswer('waterfall model', base).isCorrect).toBe(true);
  });

  it('틀리면 오답 처리한다', () => {
    const r = gradeAnswer('나선형 모델', base);
    expect(r.isCorrect).toBe(false);
    expect(r.score).toBe(0);
  });

  it('빈 답은 오답이다', () => {
    expect(gradeAnswer('   ', base).isCorrect).toBe(false);
  });
});

describe('gradeAnswer - 빈칸 여러 개', () => {
  const multi: GradableQuestion = {
    questionType: 'short_answer',
    answer: ['큐', '스택'],
    acceptedAnswers: ['Queue', 'Stack'],
    caseSensitive: false,
    orderSensitive: true,
  };

  it('줄바꿈으로 나눠 순서대로 채점한다', () => {
    const r = gradeAnswer('큐\n스택', multi);
    expect(r.isCorrect).toBe(true);
    expect(r.perSlot).toEqual([true, true]);
  });

  it('쉼표로 구분해도 채점한다', () => {
    expect(gradeAnswer('큐, 스택', multi).isCorrect).toBe(true);
  });

  it('하나만 맞으면 부분 점수를 준다', () => {
    const r = gradeAnswer('큐\n트리', multi);
    expect(r.isCorrect).toBe(false);
    expect(r.score).toBe(0.5);
    expect(r.perSlot).toEqual([true, false]);
  });

  it('orderSensitive면 순서가 바뀌면 틀린다', () => {
    expect(gradeAnswer('스택\n큐', multi).isCorrect).toBe(false);
  });

  it('orderSensitive가 아니면 순서가 바뀌어도 맞는다', () => {
    const unordered = { ...multi, orderSensitive: false };
    expect(gradeAnswer('스택\n큐', unordered).isCorrect).toBe(true);
  });

  it('답이 모자라면 부분 점수만 준다', () => {
    const r = gradeAnswer('큐', multi);
    expect(r.score).toBe(0.5);
  });
});

describe('gradeAnswer - SQL', () => {
  const sqlQ: GradableQuestion = {
    questionType: 'sql',
    answer: ["SELECT NAME FROM STUDENT WHERE DEPT = '컴퓨터';"],
    acceptedAnswers: [],
    caseSensitive: false,
    orderSensitive: false,
  };

  it('형식이 달라도 정규화해서 맞힌 것으로 본다', () => {
    expect(gradeAnswer("select name\nfrom student\nwhere dept = '컴퓨터'", sqlQ).isCorrect).toBe(true);
  });

  it('수동 확인이 필요하다고 표시한다', () => {
    expect(gradeAnswer('아무거나', sqlQ).needsManualCheck).toBe(true);
  });
});

describe('similarity / dedupe', () => {
  it('같은 문장은 1이다', () => {
    expect(similarity('스택은 LIFO 구조다', '스택은 LIFO 구조다')).toBe(1);
  });

  it('기호와 공백만 다르면 높은 유사도가 나온다', () => {
    expect(similarity('스택은 LIFO 구조다.', '스택은  LIFO  구조다')).toBeGreaterThan(0.9);
  });

  it('완전히 다른 문장은 낮다', () => {
    expect(similarity('스택은 LIFO 구조다', 'SQL의 GRANT 명령')).toBeLessThan(0.3);
  });

  it('dedupe 정규화는 기호를 제거한다', () => {
    expect(normalizeForDedupe('SELECT * FROM A;')).toBe('select from a');
  });
});
