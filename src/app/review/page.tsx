import Link from 'next/link';
import { Badge } from '@/components/QuestionBody';
import { CATEGORY_LABELS } from '@/lib/constants';
import { listQuestions } from '@/server/list';

export const dynamic = 'force-dynamic';

export default function ReviewPage() {
  const rows = listQuestions({ wrongOnly: true, limit: 300 });
  const now = Date.now();
  const due = rows.filter((r) => r.nextReviewAt && new Date(r.nextReviewAt).getTime() <= now);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[17px] font-bold">오답노트</h1>
        <span className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {rows.length}문제
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/study?mode=wrong" className="btn btn-primary text-center">
          오답 집중 풀이
        </Link>
        <Link href="/study?mode=review_due" className="btn text-center">
          복습 예정 {due.length}개
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-[14px]" style={{ color: 'var(--text-dim)' }}>
          아직 틀린 문제가 없습니다. 문제를 풀면 자동으로 쌓입니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/questions/${r.id}`} className="card block p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="bad">{`오답 ${r.wrongCount}회`}</Badge>
                  <Badge>{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                  {r.bookmarked && <Badge tone="warn">★</Badge>}
                  {r.nextReviewAt && new Date(r.nextReviewAt).getTime() <= now && (
                    <Badge tone="accent">복습 예정</Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[14.5px] leading-snug line-clamp-2">{r.question}</p>
                <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ok)' }}>
                  정답: {r.answer.join(' / ')}
                </p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                  {r.correctCount}/{r.attemptCount} 정답 · 연속 {r.streak}
                  {r.memo ? ` · 메모 있음` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
