'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { QuestionBody, QuestionMeta } from '@/components/QuestionBody';
import ExamResultView, { type ExamResultData } from '@/components/ExamResultView';
import type { QuestionDTO } from '@/lib/types';

interface Props {
  defaultCount: number;
  passScore: number;
}

const MULTILINE = new Set(['sql', 'code_output', 'descriptive']);

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExamRunner({ defaultCount, passScore }: Props) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'submitting' | 'done'>('idle');
  const [count, setCount] = useState(defaultCount);
  const [pastOnly, setPastOnly] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ExamResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // 실수로 페이지를 벗어나 답안을 잃지 않도록 경고한다.
  useEffect(() => {
    if (phase !== 'running') return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length,
    [answers, questions],
  );

  const start = async () => {
    setError(null);
    const res = await fetch('/api/exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, pastOnly }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      return;
    }
    setSessionId(data.sessionId);
    setQuestions(data.questions);
    setAnswers({});
    setIndex(0);
    startRef.current = Date.now();
    setElapsed(0);
    setPhase('running');
  };

  const submit = async () => {
    if (!sessionId) return;
    setPhase('submitting');
    const res = await fetch(`/api/exam/${sessionId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: questions.map((q) => ({ questionId: q.id, userAnswer: answers[q.id] ?? '' })),
      }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setPhase('running');
      return;
    }
    setResult(data);
    setPhase('done');
  };

  if (phase === 'done' && result) {
    return <ExamResultView result={result} elapsedSec={elapsed} />;
  }

  if (phase === 'idle') {
    return (
      <div className="space-y-3">
        <div className="card p-5">
          <h1 className="text-[18px] font-bold">모의고사</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            실제 시험과 같은 {defaultCount}문항 구성입니다. 푸는 동안 정답과 해설은 보이지 않고,
            제출한 뒤에 점수 · 영역별 결과 · 오답 · 해설을 한 번에 확인합니다. (합격 기준 {passScore}점)
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                문항 수
              </span>
              <div className="mt-1.5 flex gap-2">
                {[10, 20, 30].map((n) => (
                  <button
                    key={n}
                    className="btn flex-1 py-2"
                    style={count === n ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                    onClick={() => setCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </label>

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={pastOnly}
                onChange={(e) => setPastOnly(e.target.checked)}
                className="size-5"
              />
              <span className="text-[14px]">기출/복원 문제만 출제</span>
            </label>
          </div>

          {error && (
            <p className="mt-3 text-[13.5px]" style={{ color: 'var(--bad)' }}>
              {error}
            </p>
          )}

          <button className="btn btn-primary mt-4 w-full" onClick={start}>
            시작하기
          </button>
        </div>

        <Link href="/exam/history" className="btn block text-center">
          회차별 기록 · 종합 평균 보기
        </Link>
      </div>
    );
  }

  const q = questions[index];
  if (!q) return null;
  const multiline = MULTILINE.has(q.questionType);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {index + 1} / {questions.length} · 작성 {answeredCount}
        </span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {fmt(elapsed)}
        </span>
      </div>

      {/* 문항 점프 */}
      <div className="flex flex-wrap gap-1">
        {questions.map((item, i) => {
          const filled = (answers[item.id] ?? '').trim().length > 0;
          return (
            <button
              key={item.id}
              onClick={() => setIndex(i)}
              className="size-7 rounded-md text-[11.5px] font-semibold tabular-nums"
              style={{
                background: i === index ? 'var(--accent)' : filled ? 'var(--surface-2)' : 'transparent',
                color: i === index ? '#fff' : filled ? 'var(--text)' : 'var(--text-dim)',
                border: `1px solid ${i === index ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="card p-4">
        <QuestionMeta q={q} />
        <QuestionBody q={q} />

        <div className="mt-4">
          {multiline ? (
            <textarea
              className="field font-mono"
              rows={q.questionType === 'sql' ? 5 : 3}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder={q.questionType === 'sql' ? 'SQL문을 작성하세요' : '실행 결과를 입력하세요'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          ) : (
            <input
              className="field"
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && index < questions.length - 1) setIndex(index + 1);
              }}
              placeholder="답을 입력하세요"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          이전
        </button>
        <button
          className="btn"
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
        >
          다음
        </button>
      </div>

      {error && (
        <p className="px-1 text-[13.5px]" style={{ color: 'var(--bad)' }}>
          {error}
        </p>
      )}

      <button
        className="btn btn-primary w-full"
        onClick={() => {
          const blank = questions.length - answeredCount;
          if (blank > 0 && !confirm(`${blank}문제가 비어 있습니다. 제출할까요?`)) return;
          submit();
        }}
        disabled={phase === 'submitting'}
      >
        {phase === 'submitting' ? '채점 중…' : '제출하고 채점'}
      </button>

      <Link href="/" className="block text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
        그만두기 (답안은 저장되지 않습니다)
      </Link>
    </div>
  );
}
