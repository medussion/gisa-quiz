import { describe, expect, it } from 'vitest';
import { daysUntilExam, examConfig, scoreFor, summarizeScores } from '../src/lib/config';

describe('scoreFor', () => {
  it('20문항 만점은 100점이다', () => {
    expect(scoreFor(20, 20)).toBe(100);
  });

  it('20문항 중 12개를 맞히면 60점(합격선)이다', () => {
    expect(scoreFor(12, 20)).toBe(examConfig.passScore);
  });

  it('문항 수가 달라도 100점 만점으로 환산한다', () => {
    expect(scoreFor(5, 10)).toBe(50);
    expect(scoreFor(6, 10)).toBe(60);
    expect(scoreFor(21, 30)).toBe(70);
  });

  it('문항이 없으면 0점이다', () => {
    expect(scoreFor(0, 0)).toBe(0);
  });
});

describe('daysUntilExam', () => {
  it('시험 당일은 0이다', () => {
    const [y, m, d] = examConfig.examDate.split('-').map(Number);
    expect(daysUntilExam(new Date(y, m - 1, d))).toBe(0);
  });

  it('하루 전이면 1이다', () => {
    const [y, m, d] = examConfig.examDate.split('-').map(Number);
    expect(daysUntilExam(new Date(y, m - 1, d - 1))).toBe(1);
  });

  it('시험이 지나면 음수가 된다', () => {
    const [y, m, d] = examConfig.examDate.split('-').map(Number);
    expect(daysUntilExam(new Date(y, m - 1, d + 3))).toBe(-3);
  });
});

describe('summarizeScores', () => {
  it('기록이 없으면 전부 null이다', () => {
    const s = summarizeScores([]);
    expect(s.count).toBe(0);
    expect(s.average).toBeNull();
    expect(s.delta).toBeNull();
    expect(s.passRate).toBeNull();
  });

  it('종합 평균을 소수 첫째 자리까지 낸다', () => {
    expect(summarizeScores([45, 65, 55, 75]).average).toBe(60);
    expect(summarizeScores([45, 50]).average).toBe(47.5);
  });

  it('최근 5회만 따로 평균 낸다', () => {
    const s = summarizeScores([0, 0, 100, 100, 100, 100, 100]);
    expect(s.average).toBeLessThan(100);
    expect(s.recentAverage).toBe(100);
  });

  it('최고 · 최저 · 최근 점수를 뽑는다', () => {
    const s = summarizeScores([45, 65, 55, 75]);
    expect(s.best).toBe(75);
    expect(s.worst).toBe(45);
    expect(s.latest).toBe(75);
  });

  it('직전 회차 대비 변화를 계산한다', () => {
    expect(summarizeScores([65, 55]).delta).toBe(-10);
    expect(summarizeScores([55, 75]).delta).toBe(20);
    expect(summarizeScores([55]).delta).toBeNull();
  });

  it('합격 기준 이상인 회차 수와 비율을 센다', () => {
    const s = summarizeScores([45, 65, 55, 75]);
    expect(s.passCount).toBe(2);
    expect(s.passRate).toBe(0.5);
  });

  it('합격 기준과 정확히 같은 점수도 합격으로 센다', () => {
    expect(summarizeScores([examConfig.passScore]).passCount).toBe(1);
  });
});
