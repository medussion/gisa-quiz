'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, QuestionBody, QuestionMeta } from '@/components/QuestionBody';
import type { RevealedQuestion } from '@/lib/types';

export interface ExamResultData {
  sessionId: number;
  score: number;
  passScore: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  byCategory: { category: string; label: string; total: number; correct: number }[];
  items: {
    question: RevealedQuestion;
    userAnswer: string;
    isCorrect: boolean;
    score: number;
    attemptId: number;
    needsManualCheck: boolean;
  }[];
}

export default function ExamResultView({
  result,
  elapsedSec,
}: {
  result: ExamResultData;
  elapsedSec?: number;
}) {
  const [onlyWrong, setOnlyWrong] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const isCorrectOf = (attemptId: number, fallback: boolean) => overrides[attemptId] ?? fallback;
  const shown = result.items.filter((i) => !onlyWrong || !isCorrectOf(i.attemptId, i.isCorrect));

  const override = async (attemptId: number, isCorrect: boolean) => {
    setOverrides((o) => ({ ...o, [attemptId]: isCorrect }));
    await fetch(`/api/attempts/${attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCorrect }),
    });
  };

  return (
    <div className="space-y-3">
      <div className="card p-5 text-center">
        <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          모의고사 결과
        </p>
        <p
          className="mt-1 text-[44px] font-bold leading-none tabular-nums"
          style={{ color: result.passed ? 'var(--ok)' : 'var(--bad)' }}
        >
          {result.score}
          <span className="text-[18px]" style={{ color: 'var(--text-dim)' }}>
            점
          </span>
        </p>
        <p className="mt-2 text-[14px]">
          {result.correctCount} / {result.questionCount} 정답
          <span style={{ color: 'var(--text-dim)' }}> · 합격 기준 {result.passScore}점</span>
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <Badge tone={result.passed ? 'ok' : 'bad'}>{result.passed ? '합격권' : '불합격권'}</Badge>
          {typeof elapsedSec === 'number' && (
            <Badge>{`소요 ${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초`}</Badge>
          )}
        </div>
      </div>

      <section className="card p-4">
        <h2 className="text-[13px] font-bold">영역별 결과</h2>
        <ul className="mt-2 space-y-1.5">
          {result.byCategory.map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-[13.5px]">
              <span className="w-[50%] shrink-0 truncate">{c.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(c.correct / c.total) * 100}%`,
                    background: c.correct / c.total >= 0.6 ? 'var(--ok)' : 'var(--bad)',
                  }}
                />
              </span>
              <span className="w-10 text-right tabular-nums text-[12px]" style={{ color: 'var(--text-dim)' }}>
                {c.correct}/{c.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-between px-1">
        <h2 className="text-[14px] font-bold">문제 복습</h2>
        <button
          className="text-[13px] font-medium"
          style={{ color: 'var(--accent)' }}
          onClick={() => setOnlyWrong((v) => !v)}
        >
          {onlyWrong ? '전체 보기' : '오답만 보기'}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="card p-5 text-center text-[14px]" style={{ color: 'var(--text-dim)' }}>
          틀린 문제가 없습니다.
        </p>
      ) : (
        shown.map((item, i) => {
          const correct = isCorrectOf(item.attemptId, item.isCorrect);
          return (
            <article key={item.question.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <QuestionMeta q={item.question} />
                <Badge tone={correct ? 'ok' : 'bad'}>{correct ? '정답' : '오답'}</Badge>
              </div>
              <p className="mt-2 text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                {i + 1}번째 표시 문항
              </p>
              <QuestionBody q={item.question} />

              <dl className="mt-3 space-y-2 text-[14px]">
                <div>
                  <dt className="text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                    내 답
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap font-mono text-[13.5px]">
                    {item.userAnswer || '(미입력)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                    정답
                  </dt>
                  <dd
                    className="mt-0.5 whitespace-pre-wrap font-mono text-[13.5px]"
                    style={{ color: 'var(--ok)' }}
                  >
                    {item.question.answer.join('\n')}
                  </dd>
                </div>
                {item.question.explanation && (
                  <div>
                    <dt className="text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                      해설
                    </dt>
                    <dd className="mt-0.5 leading-relaxed whitespace-pre-wrap">{item.question.explanation}</dd>
                  </div>
                )}
              </dl>

              {item.needsManualCheck && (
                <div className="mt-3 flex gap-2">
                  <button className="btn flex-1 py-2 text-[13px]" onClick={() => override(item.attemptId, true)}>
                    정답 처리
                  </button>
                  <button className="btn flex-1 py-2 text-[13px]" onClick={() => override(item.attemptId, false)}>
                    오답 처리
                  </button>
                </div>
              )}
            </article>
          );
        })
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/study?mode=recent_wrong" className="btn btn-primary text-center">
          오답 바로 복습
        </Link>
        <Link href="/exam/history" className="btn text-center">
          회차별 기록
        </Link>
      </div>
      <Link href="/" className="btn block text-center">
        홈으로
      </Link>
    </div>
  );
}
