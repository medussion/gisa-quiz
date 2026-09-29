import { describe, expect, it } from 'vitest';
import { parseAnswer } from '../scripts/collect/parse-newbt';
import { classifyCategory, classifyQuestionType } from '../scripts/collect/classify';
import { preToText, tableToText } from '../scripts/collect/html';

describe('parseAnswer — 출처의 정답 문자열 해석', () => {
  it('한 줄이면 정답 하나다', () => {
    const r = parseAnswer('폭포수 모델');
    expect(r.answer).toEqual(['폭포수 모델']);
    expect(r.orderSensitive).toBe(false);
  });

  it('①②③ 는 빈칸 여러 개로 본다', () => {
    const r = parseAnswer('① 튜플\n\n② 릴레이션 인스턴스\n\n③ 카디널리티');
    expect(r.answer).toEqual(['튜플', '릴레이션 인스턴스', '카디널리티']);
    expect(r.orderSensitive).toBe(true);
  });

  it('(1)(2) 형태도 빈칸으로 본다', () => {
    expect(parseAnswer('(1) 구문 커버리지\n\n(2) 결정 커버리지').answer).toEqual([
      '구문 커버리지',
      '결정 커버리지',
    ]);
  });

  it('1. 2. 형태도 빈칸으로 본다', () => {
    expect(parseAnswer('1. redo\n\n2. undo').answer).toEqual(['redo', 'undo']);
  });

  it('번호 자체가 정답이면 지우지 않는다', () => {
    // 그림에서 번호를 고르는 문제
    const r = parseAnswer('④\n\n③\n\n①\n\n②\n\n⑤');
    expect(r.answer).toEqual(['④', '③', '①', '②', '⑤']);
  });

  it('- 로 나열된 것은 같은 뜻의 다른 표현으로 본다', () => {
    const r = parseAnswer('- 코드를 이해하기 쉽게 개선\n\n- 외부 행위를 바꾸지 않고 내부 구조를 개선');
    expect(r.answer).toHaveLength(1);
    expect(r.acceptedAnswers).toHaveLength(1);
    expect(r.orderSensitive).toBe(false);
  });

  it('괄호 안 보충 설명을 뗀 표기도 정답으로 허용한다', () => {
    expect(parseAnswer('0 (숫자 0)').acceptedAnswers).toContain('0');
  });

  it('영문 풀이가 괄호에 있으면 그것도 허용한다', () => {
    expect(parseAnswer('UX(User Experience)').acceptedAnswers).toContain('User Experience');
  });
});

describe('classifyQuestionType', () => {
  const base = { question: '', code: '', answer: '', wikiTopics: [] };

  it('SQL을 쓰라는 문제는 sql', () => {
    expect(classifyQuestionType({ ...base, question: '조회하는 SQL문을 작성하시오.' })).toBe('sql');
  });

  it('코드 실행 결과를 묻는 문제는 code_output', () => {
    expect(
      classifyQuestionType({ ...base, question: '출력 결과를 쓰시오.', code: '#include <stdio.h>\nprintf("x");' }),
    ).toBe('code_output');
  });

  it('설명하라는 문제는 서술형', () => {
    expect(classifyQuestionType({ ...base, question: '리팩토링의 목적을 서술하시오.' })).toBe('descriptive');
  });

  it('한 낱말 정답은 용어', () => {
    expect(classifyQuestionType({ ...base, question: '무엇인가?', answer: 'DISTINCT' })).toBe('term');
  });
});

describe('classifyCategory', () => {
  const base = { question: '', code: '', answer: '', wikiTopics: [] };

  it('SELECT 가 보이면 SQL 응용', () => {
    expect(classifyCategory({ ...base, code: 'SELECT * FROM 학생;' })).toBe('sql');
  });

  it('코드가 그림뿐이어도 지문으로 프로그래밍 언어를 알아낸다', () => {
    expect(classifyCategory({ ...base, question: '다음은 Java언어의 문제이다. 알맞는 출력값을 작성하시오.' })).toBe(
      'programming_language',
    );
  });

  it('릴리즈 노트는 보안 낱말이 섞여도 패키징이다', () => {
    expect(classifyCategory({ ...base, question: '릴리즈 노트의 구성 항목 중 보안 관련 설명은?' })).toBe('packaging');
  });

  it('형상 관리 도구는 통합 구현이다', () => {
    expect(classifyCategory({ ...base, question: '형상 관리 도구에 해당하는 것을 고르시오.' })).toBe('integration');
  });

  it('아무 규칙에도 안 걸리면 etc', () => {
    expect(classifyCategory({ ...base, question: '다음 빈칸을 채우시오.' })).toBe('etc');
  });
});

describe('html 도구', () => {
  it('표를 텍스트 표로 바꾼다', () => {
    const out = tableToText('<table><tr><th>이름</th><th>점수</th></tr><tr><td>홍길동</td><td>90</td></tr></table>');
    expect(out).toContain('이름');
    expect(out).toContain('홍길동');
    expect(out.split('\n')).toHaveLength(3);
  });

  it('pre 안의 들여쓰기를 지킨다', () => {
    expect(preToText('if (a) {\n    b();\n}')).toBe('if (a) {\n    b();\n}');
  });

  it('엔티티를 되돌린다', () => {
    expect(preToText('a &lt; b &amp;&amp; c &gt; d')).toBe('a < b && c > d');
  });
});
