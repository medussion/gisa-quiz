'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, QuestionBody, QuestionMeta } from '@/components/QuestionBody';
import type { GradeResponse, QuestionDTO } from '@/lib/types';

interface Props {
  mode: string;
  modeLabel: string;
  count: number;
  filters?: Record<string, string | number | boolean | undefined>;
}

interface Done {
  question: QuestionDTO;
  result: GradeResponse;
}

const MULTILINE_TYPES = new Set(['sql', 'code_output', 'descriptive']);

export default function QuestionRunner({ mode, modeLabel, count, filters }: Props) {
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Done[]>([]);
  const [memoOpen, setMemoOpen] = useState(false);
  const [hint, setHint] = useState<{ text: string; auto: boolean } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [memo, setMemo] = useState('');
  const [bookmarked, setBookmarked] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, count, ...(filters ?? {}) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setQuestions(data.questions ?? []);
      })
      .catch(() => !cancelled && setError('문제를 불러오지 못했습니다.'));
    return () => {
      cancelled = true;
    };
    // filters는 페이지에서 고정값으로 넘어온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, count]);

  const current = questions?.[index];

  useEffect(() => {
    startedAt.current = Date.now();
    inputRef.current?.focus();
  }, [index, questions]);

  const send = useCallback(
    async (opts: { reveal?: boolean } = {}) => {
      if (!current || submitting || result) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: current.id,
            userAnswer: answer,
            mode,
            durationMs: Date.now() - startedAt.current,
            usedHint: hint !== null,
            reveal: opts.reveal ?? false,
          }),
        });
        const data: GradeResponse = await res.json();
        setResult(data);
        setMemo(data.progress.memo ?? '');
        setBookmarked(data.progress.bookmarked ?? false);
      } finally {
        setSubmitting(false);
      }
    },
    [answer, current, hint, mode, result, submitting],
  );

  const submit = useCallback(() => send(), [send]);

  const showHint = useCallback(async () => {
    if (!current || hint || hintLoading) return;
    setHintLoading(true);
    try {
      const res = await fetch(`/api/questions/${current.id}/hint`);
      const data = await res.json();
      if (!data.error) setHint(data);
    } finally {
      setHintLoading(false);
    }
  }, [current, hint, hintLoading]);

  const next = useCallback(() => {
    if (!current || !result) return;
    setDone((d) => [...d, { question: current, result }]);
    setResult(null);
    setAnswer('');
    setMemoOpen(false);
    setHint(null);
    setConfirmReveal(false);
    setIndex((i) => i + 1);
  }, [current, result]);

  const override = async (isCorrect: boolean) => {
    if (!result) return;
    const res = await fetch(`/api/attempts/${result.attemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCorrect }),
    });
    const data = await res.json().catch(() => null);
    setResult({
      ...result,
      isCorrect,
      score: isCorrect ? 1 : 0,
      progress: data?.progress ?? result.progress,
    });
  };

  const toggleBookmark = async () => {
    if (!current) return;
    const nextValue = !bookmarked;
    setBookmarked(nextValue);
    await fetch(`/api/questions/${current.id}/bookmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarked: nextValue }),
    });
  };

  const saveMemo = async () => {
    if (!current) return;
    await fetch(`/api/questions/${current.id}/memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo }),
    });
    setMemoOpen(false);
  };

  if (error) {
    return (
      <div className="card p-5">
        <p className="text-[15px]">{error}</p>
        <Link href="/" className="btn mt-4 inline-block">
          홈으로
        </Link>
      </div>
    );
  }

  if (!questions) {
    return <p className="py-10 text-center text-[15px]" style={{ color: 'var(--text-dim)' }}>불러오는 중…</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="card p-5">
        <h1 className="text-[17px] font-bold">{modeLabel}</h1>
        <p className="mt-2 text-[15px]" style={{ color: 'var(--text-dim)' }}>
          출제할 문제가 없습니다. <code>npm run questions:import</code> 로 문제를 넣었는지 확인하세요.
        </p>
        <Link href="/" className="btn mt-4 inline-block">
          홈으로
        </Link>
      </div>
    );
  }

  // ── 세션 종료 화면 ────────────────────────────────────────
  if (!current) {
    const correct = done.filter((d) => d.result.isCorrect).length;
    const wrong = done.filter((d) => !d.result.isCorrect);
    return (
      <div className="space-y-3">
        <div className="card p-5 text-center">
          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
            {modeLabel} 완료
          </p>
          <p className="mt-1 text-[34px] font-bold tabular-nums">
            {correct}
            <span className="text-[18px]" style={{ color: 'var(--text-dim)' }}>
              {' '}
              / {done.length}
            </span>
          </p>
          <p className="mt-1 text-[14px]" style={{ color: 'var(--text-dim)' }}>
            정답률 {done.length ? Math.round((correct / done.length) * 100) : 0}%
          </p>
        </div>

        {wrong.length > 0 && (
          <div className="card p-4">
            <h2 className="text-[14px] font-bold">틀린 문제 {wrong.length}개</h2>
            <ul className="mt-2 space-y-2">
              {wrong.map((d) => (
                <li key={d.question.id} className="text-[14px] leading-snug">
                  <Link href={`/questions/${d.question.id}`} className="underline underline-offset-2">
                    {d.question.question.slice(0, 48)}…
                  </Link>
                  <div className="mt-0.5" style={{ color: 'var(--ok)' }}>
                    정답: {d.result.revealed.answer.join(' / ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            같은 모드로 계속
          </button>
          <Link href="/" className="btn text-center">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  const multiline = MULTILINE_TYPES.has(current.questionType) || current.questionType === 'sql';
  const slots = result?.perSlot.length ?? 1;

  return (
    <div className="space-y-3">
      {/* 진행 표시 */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(index / questions.length) * 100}%`, background: 'var(--accent)' }}
          />
        </div>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text-dim)' }}>
          {index + 1} / {questions.length}
        </span>
      </div>

      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <QuestionMeta q={current} />
          <button
            onClick={toggleBookmark}
            aria-label="북마크"
            className="shrink-0 rounded-lg px-2 py-1 text-[18px] leading-none"
            style={{ color: bookmarked ? 'var(--warn)' : 'var(--text-dim)' }}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        </div>

        <QuestionBody q={current} />

        {/* 답 입력 */}
        {!result ? (
          <div className="mt-4">
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                className="field font-mono"
                rows={current.questionType === 'sql' ? 5 : 3}
                placeholder={current.questionType === 'sql' ? 'SQL문을 작성하세요' : '실행 결과를 입력하세요'}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                className="field"
                placeholder={
                  current.questionType === 'multiple_choice' ? '번호 또는 답을 입력' : '답을 입력하세요'
                }
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            )}
            <button className="btn btn-primary mt-3 w-full" onClick={submit} disabled={submitting}>
              {submitting ? '채점 중…' : '제출'}
            </button>

            {/* 힌트 · 정답 보기 */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                className="btn flex-1 py-2 text-[13px]"
                onClick={showHint}
                disabled={hintLoading || hint !== null}
              >
                {hint ? '힌트 표시됨' : hintLoading ? '불러오는 중…' : '힌트 보기'}
              </button>
              {!confirmReveal ? (
                <button
                  type="button"
                  className="btn flex-1 py-2 text-[13px]"
                  onClick={() => setConfirmReveal(true)}
                  disabled={submitting}
                >
                  정답 보기
                </button>
              ) : (
                <button
                  type="button"
                  className="btn flex-1 py-2 text-[13px]"
                  style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                  onClick={() => send({ reveal: true })}
                  disabled={submitting}
                >
                  오답 처리하고 공개
                </button>
              )}
            </div>
            {confirmReveal && (
              <p className="mt-1.5 text-center text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                정답을 열어보면 오답으로 기록되어 복습 대상에 남습니다.
              </p>
            )}

            {hint && (
              <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: 'var(--warn-bg)' }}>
                <p className="text-[11.5px] font-bold" style={{ color: 'var(--warn)' }}>
                  힌트{hint.auto ? ' (정답 형태)' : ''}
                </p>
                <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{hint.text}</p>
              </div>
            )}

            {multiline && (
              <p className="mt-2 text-center text-[12px]" style={{ color: 'var(--text-dim)' }}>
                ⌘/Ctrl + Enter 로도 제출됩니다
              </p>
            )}
          </div>
        ) : (
          <Result
            result={result}
            answer={answer}
            slots={slots}
            onNext={next}
            onOverride={override}
            isLast={index === questions.length - 1}
            usedHint={hint !== null}
          />
        )}
      </div>

      {/* 메모 */}
      {result && (
        <div className="card p-4">
          {!memoOpen ? (
            <div className="flex items-center justify-between">
              <button
                className="text-[14px] font-medium"
                style={{ color: 'var(--accent)' }}
                onClick={() => setMemoOpen(true)}
              >
                {memo ? '메모 수정' : '메모 남기기'}
              </button>
              <Link
                href={`/questions/${current.id}/edit`}
                className="text-[13px]"
                style={{ color: 'var(--text-dim)' }}
              >
                문제 수정
              </Link>
            </div>
          ) : (
            <>
              <textarea
                className="field"
                rows={3}
                value={memo}
                placeholder="헷갈린 이유, 외울 포인트 등"
                onChange={(e) => setMemo(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primary flex-1" onClick={saveMemo}>
                  저장
                </button>
                <button className="btn" onClick={() => setMemoOpen(false)}>
                  취소
                </button>
              </div>
            </>
          )}
          {memo && !memoOpen && <p className="mt-2 text-[14px] whitespace-pre-wrap">{memo}</p>}
        </div>
      )}
    </div>
  );
}

function Result({
  result,
  answer,
  slots,
  onNext,
  onOverride,
  isLast,
  usedHint,
}: {
  result: GradeResponse;
  answer: string;
  slots: number;
  onNext: () => void;
  onOverride: (isCorrect: boolean) => void;
  isLast: boolean;
  usedHint: boolean;
}) {
  const partial = !result.isCorrect && result.score > 0;
  return (
    <div className="mt-4">
      <div
        className="rounded-xl px-4 py-3"
        style={{
          background: result.isCorrect ? 'var(--ok-bg)' : 'var(--bad-bg)',
          color: result.isCorrect ? 'var(--ok)' : 'var(--bad)',
        }}
      >
        <p className="text-[17px] font-bold">
          {result.wasRevealed ? '정답 공개' : result.isCorrect ? '정답' : '오답'}
          {partial && slots > 1 && (
            <span className="ml-2 text-[13px] font-semibold">
              부분 정답 {result.perSlot.filter(Boolean).length}/{slots}
            </span>
          )}
        </p>
      </div>

      <dl className="mt-3 space-y-3 text-[15px]">
        <div>
          <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
            내 답
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap font-mono text-[14px]">{answer || '(미입력)'}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
            정답
          </dt>
          <dd className="mt-0.5 whitespace-pre-wrap font-mono text-[14px]" style={{ color: 'var(--ok)' }}>
            {result.revealed.answer.join('\n')}
          </dd>
          {result.revealed.acceptedAnswers.length > 0 && (
            <dd className="mt-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
              추가 허용: {result.revealed.acceptedAnswers.join(', ')}
            </dd>
          )}
        </div>
        {result.revealed.explanation && (
          <div>
            <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
              해설
            </dt>
            <dd className="mt-0.5 leading-relaxed whitespace-pre-wrap">{result.revealed.explanation}</dd>
          </div>
        )}
      </dl>

      {result.needsManualCheck && (
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--warn-bg)' }}>
          <p className="text-[13px] font-medium" style={{ color: 'var(--warn)' }}>
            SQL은 자동 채점이 정확하지 않을 수 있습니다. 직접 보정하세요.
          </p>
          <div className="mt-2 flex gap-2">
            <button className="btn flex-1 py-2" onClick={() => onOverride(true)}>
              정답 처리
            </button>
            <button className="btn flex-1 py-2" onClick={() => onOverride(false)}>
              오답 처리
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-dim)' }}>
        {result.wasRevealed && <Badge tone="bad">정답 확인 · 오답 처리</Badge>}
        {usedHint && !result.wasRevealed && <Badge tone="warn">힌트 사용</Badge>}
        <Badge>{`누적 ${result.progress.correctCount}/${result.progress.attemptCount}`}</Badge>
        <Badge>{`연속 정답 ${result.progress.streak}`}</Badge>
        {result.progress.nextReviewAt && (
          <Badge>{`다음 복습 ${result.progress.nextReviewAt.slice(0, 10)}`}</Badge>
        )}
      </div>

      <button className="btn btn-primary mt-4 w-full" onClick={onNext} autoFocus>
        {isLast ? '결과 보기' : '다음 문제'}
      </button>
    </div>
  );
}
