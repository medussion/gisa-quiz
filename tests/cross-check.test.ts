import { describe, expect, it } from 'vitest';
import { audit, findRepeats } from '../scripts/collect/cross-check';
import { applyCorrections, type Correction } from '../scripts/collect/parse-newbt';
import type { RawQuestion } from '../src/lib/question-schema';

function q(over: Partial<RawQuestion>): RawQuestion {
  return {
    id: 'x',
    sourceType: 'past_exam',
    category: 'etc',
    questionType: 'short_answer',
    question: '문제',
    answer: ['답'],
    year: 2020,
    round: 1,
    ...over,
  } as RawQuestion;
}

const NAT = 'IP 패킷에서 외부의 공인 IP주소에 해당하는 내부 IP주소를 재기록하는 기술은 무엇인가?';

describe('findRepeats — 회차 간 반복 출제 대조', () => {
  it('다른 회차의 같은 문제를 찾아낸다', () => {
    const pairs = findRepeats([
      q({ id: 'a', year: 2020, round: 4, question: NAT, answer: ['NAT'] }),
      q({ id: 'b', year: 2023, round: 3, question: NAT, answer: ['NAT'] }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].agree).toBe(true);
  });

  it('같은 회차 안의 비슷한 문항은 반복 출제가 아니다', () => {
    expect(
      findRepeats([
        q({ id: 'a', year: 2020, round: 1, question: NAT }),
        q({ id: 'b', year: 2020, round: 1, question: NAT }),
      ]),
    ).toHaveLength(0);
  });

  it('괄호 안 풀이만 다르면 핵심 일치로 본다', () => {
    const pairs = findRepeats([
      q({ id: 'a', year: 2020, round: 4, question: NAT, answer: ['NAT(Network Address Translation)'] }),
      q({ id: 'b', year: 2023, round: 3, question: NAT, answer: ['NAT(Network Address Transformation)'] }),
    ]);
    expect(pairs[0].agree).toBe(false);
    expect(pairs[0].agreeCore).toBe(true);
  });

  it('정답이 아예 다르면 불일치로 본다', () => {
    const pairs = findRepeats([
      q({ id: 'a', year: 2020, round: 4, question: NAT, answer: ['NAT'] }),
      q({ id: 'b', year: 2023, round: 3, question: NAT, answer: ['DHCP'] }),
    ]);
    expect(pairs[0].agreeCore).toBe(false);
  });

  it('코드가 한 줄이라도 다르면 다른 문제로 본다', () => {
    // 지문은 같지만 코드가 달라 답도 다른 경우 (실제로 2021-3-001 과 2024-1-001 이 그랬다)
    const text = '다음 Java 코드에 대한 알맞는 출력값을 쓰시오. 싱글톤 패턴을 사용한 코드이다.';
    expect(
      findRepeats([
        q({ id: 'a', year: 2021, round: 3, question: text, code: 'conn.count(); conn.count(); conn.count();', answer: ['3'] }),
        q({ id: 'b', year: 2024, round: 1, question: text, code: 'conn.count(); conn.count(); conn.count(); conn.count();', answer: ['4'] }),
      ]),
    ).toHaveLength(0);
  });

  it('본문이 그림뿐이면 글자로 비교하지 않는다', () => {
    const text = '다음은 Java언어의 문제이다. 아래 코드를 보고 알맞는 출력값을 작성하시오.';
    expect(
      findRepeats([
        q({ id: 'a', year: 2025, round: 1, question: text, image: '/q/a.png', answer: ['1'] }),
        q({ id: 'b', year: 2025, round: 2, question: text, image: '/q/b.png', answer: ['2'] }),
      ]),
    ).toHaveLength(0);
  });
});

describe('audit — 풀 수 없는 문항 찾기', () => {
  it('정답이 비면 출제에서 뺀다', () => {
    const r = audit([q({ id: 'a', answer: [''] })]);
    expect(r[0].level).toBe('reject');
  });

  it('그림을 보라는데 그림이 없으면 뺀다', () => {
    const r = audit([q({ id: 'a', question: '아래 설명에 맞는 번호를 그림에서 골라 작성하시오.', code: 'ㄱ. 설명' })]);
    expect(r[0].level).toBe('reject');
  });

  it('그림이 있으면 통과한다', () => {
    expect(audit([q({ id: 'a', question: '그림에서 고르시오.', image: '/q/a.png' })])).toHaveLength(0);
  });

  it('정답이 확정되지 않았다는 표시는 사람이 보게 남긴다', () => {
    const r = audit([q({ id: 'a', answer: ['확인 필요'] })]);
    expect(r[0].level).toBe('review');
  });

  it('멀쩡한 문항은 걸리지 않는다', () => {
    expect(audit([q({ id: 'a', question: '무엇인가?', answer: ['NAT'] })])).toHaveLength(0);
  });
});

describe('applyCorrections — 보정이 재파싱을 이겨낸다', () => {
  const corrections = new Map<string, Correction>([
    ['a', { id: 'a', reason: '정식 명칭이 Translation 입니다.', patch: { answer: ['NAT(Network Address Translation)'] } }],
  ]);

  it('reason 이 있으면 덮어쓴다', () => {
    const list = [{ id: 'a', answer: ['NAT(Network Address Transformation)'] }];
    expect(applyCorrections(list, corrections)).toBe(1);
    expect(list[0].answer).toEqual(['NAT(Network Address Translation)']);
  });

  it('근거(reason)가 없는 보정은 무시한다', () => {
    const list = [{ id: 'b', answer: ['원본'] }];
    const noReason = new Map<string, Correction>([['b', { id: 'b', reason: '  ', patch: { answer: ['바꿈'] } }]]);
    expect(applyCorrections(list, noReason)).toBe(0);
    expect(list[0].answer).toEqual(['원본']);
  });

  it('해당 없는 문항은 건드리지 않는다', () => {
    const list = [{ id: 'z', answer: ['그대로'] }];
    expect(applyCorrections(list, corrections)).toBe(0);
  });
});
