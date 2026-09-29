import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Badge, QuestionBody, QuestionMeta } from '@/components/QuestionBody';
import { db } from '@/db';
import { questionProgress } from '@/db/schema';
import { getAttemptHistory } from '@/server/attempts';
import { getHint, getQuestion, toRevealed } from '@/server/questions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getQuestion(id);
  if (!row) notFound();

  const q = toRevealed(row);
  const progress = db.select().from(questionProgress).where(eq(questionProgress.questionId, id)).get();
  const history = getAttemptHistory(id, 20);
  const hint = getHint(id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <Link href="/questions" className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          ← 문제 목록
        </Link>
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[12px]" style={{ color: 'var(--text-dim)' }}>
            {q.id}
          </span>
          <Link
            href={`/questions/${q.id}/edit`}
            className="rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            수정
          </Link>
        </span>
      </div>

      {!row.active && (
        <p className="card px-4 py-2.5 text-[13px]" style={{ color: 'var(--warn)' }}>
          출제에서 제외된 문제입니다. 수정 화면에서 되돌릴 수 있습니다.
        </p>
      )}

      <article className="card p-4">
        <QuestionMeta q={q} />
        <QuestionBody q={q} />

        <dl className="mt-4 space-y-3 text-[15px]">
          {hint && (
            <div>
              <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                힌트{hint.auto ? ' (정답 형태에서 자동 생성)' : ''}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[14px]">{hint.text}</dd>
            </div>
          )}
          <div>
            <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
              정답
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap font-mono text-[14px]" style={{ color: 'var(--ok)' }}>
              {q.answer.join('\n')}
            </dd>
            {q.acceptedAnswers.length > 0 && (
              <dd className="mt-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
                추가 허용: {q.acceptedAnswers.join(', ')}
              </dd>
            )}
          </div>
          {q.explanation && (
            <div>
              <dt className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                해설
              </dt>
              <dd className="mt-0.5 leading-relaxed whitespace-pre-wrap">{q.explanation}</dd>
            </div>
          )}
        </dl>
      </article>

      {/* 출처 */}
      <section className="card p-4">
        <h2 className="text-[13px] font-bold">출처 · 검증</h2>
        <p className="mt-1.5 text-[13.5px]">{q.sourceLabel || '(라벨 없음)'}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={q.sourceType === 'past_exam' ? 'ok' : 'warn'}>{q.badge}</Badge>
          <Badge>{q.verificationStatus}</Badge>
          <Badge>{`난이도 ${q.difficulty}`}</Badge>
        </div>
        {q.sourceUrls.length > 0 && (
          <ul className="mt-2 space-y-1">
            {q.sourceUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[12.5px] underline underline-offset-2"
                  style={{ color: 'var(--accent)' }}
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        )}
        {q.verificationStatus === 'unverified' && (
          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--warn)' }}>
            검증되지 않은 문제입니다. 정답이 정확하지 않을 수 있습니다.
          </p>
        )}
      </section>

      {/* 진도 */}
      <section className="card p-4">
        <h2 className="text-[13px] font-bold">내 진행 상황</h2>
        {!progress || progress.attemptCount === 0 ? (
          <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
            아직 풀지 않은 문제입니다.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{`${progress.correctCount}/${progress.attemptCount} 정답`}</Badge>
              <Badge tone={progress.wrongCount > 0 ? 'bad' : 'default'}>{`오답 ${progress.wrongCount}`}</Badge>
              <Badge>{`연속 ${progress.streak}`}</Badge>
              <Badge>{`숙련도 ${Math.round(progress.masteryScore * 100)}%`}</Badge>
              {progress.nextReviewAt && <Badge tone="accent">{`복습 ${progress.nextReviewAt.slice(0, 10)}`}</Badge>}
              {progress.bookmarked && <Badge tone="warn">★ 북마크</Badge>}
            </div>
            {progress.memo && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                  메모
                </p>
                <p className="mt-0.5 text-[14px] whitespace-pre-wrap">{progress.memo}</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* 풀이 이력 */}
      <section className="card p-4">
        <h2 className="text-[13px] font-bold">풀이 이력</h2>
        {history.length === 0 ? (
          <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
            기록이 없습니다.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <Badge tone={a.isCorrect ? 'ok' : 'bad'}>{a.isCorrect ? 'O' : 'X'}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px]">{a.userAnswer || '(미입력)'}</p>
                  <p className="text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                    {fmtDate(a.answeredAt)} · {a.mode}
                    {a.revealed ? ' · 정답 확인' : ''}
                    {a.usedHint ? ' · 힌트 사용' : ''}
                    {a.manualOverride ? ' · 수동 보정' : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
