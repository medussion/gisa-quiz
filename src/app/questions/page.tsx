import Link from 'next/link';
import { Badge } from '@/components/QuestionBody';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  SOURCE_TYPES,
} from '@/lib/constants';
import { availableYears, listQuestions } from '@/server/list';

export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function buildHref(base: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const merged = { ...base, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/questions?${qs}` : '/questions';
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border px-2.5 py-1 text-[12.5px] whitespace-nowrap"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
      }}
    >
      {children}
    </Link>
  );
}

export default async function QuestionsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const current = {
    category: one(sp.category),
    questionType: one(sp.questionType),
    sourceType: one(sp.sourceType),
    year: one(sp.year),
    difficulty: one(sp.difficulty),
    bookmarked: one(sp.bookmarked),
    inactive: one(sp.inactive),
    q: one(sp.q),
  };

  const rows = listQuestions({
    category: current.category,
    questionType: current.questionType,
    sourceType: current.sourceType,
    year: current.year ? Number(current.year) : undefined,
    difficulty: current.difficulty ? Number(current.difficulty) : undefined,
    bookmarked: current.bookmarked === '1',
    activeFilter: current.inactive === '1' ? 'inactive' : 'active',
    search: current.q,
    limit: 300,
  });

  const years = [...new Set(availableYears().map((y) => y.year))];
  const studyParams = new URLSearchParams();
  if (current.category) studyParams.set('category', current.category);
  if (current.questionType) studyParams.set('questionType', current.questionType);
  if (current.year) studyParams.set('year', current.year);
  if (current.difficulty) studyParams.set('difficulty', current.difficulty);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[17px] font-bold">
          문제 목록
          <span className="ml-2 text-[13px] font-normal" style={{ color: 'var(--text-dim)' }}>
            {rows.length}문제
          </span>
        </h1>
        <Link
          href="/questions/new"
          className="rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          + 문제 추가
        </Link>
      </div>

      <form action="/questions" className="flex gap-2">
        {Object.entries(current).map(([k, v]) =>
          k !== 'q' && v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <input
          className="field"
          name="q"
          defaultValue={current.q ?? ''}
          placeholder="문제/정답 검색"
          autoCapitalize="off"
        />
        <button className="btn shrink-0">검색</button>
      </form>

      <div className="space-y-1.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip href={buildHref(current, { category: undefined })} active={!current.category}>
            전체 영역
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              href={buildHref(current, { category: c.id })}
              active={current.category === c.id}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip href={buildHref(current, { questionType: undefined })} active={!current.questionType}>
            전체 유형
          </Chip>
          {QUESTION_TYPES.map((t) => (
            <Chip
              key={t.id}
              href={buildHref(current, { questionType: t.id })}
              active={current.questionType === t.id}
            >
              {t.label}
            </Chip>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip href={buildHref(current, { sourceType: undefined })} active={!current.sourceType}>
            전체 출처
          </Chip>
          {SOURCE_TYPES.map((s) => (
            <Chip
              key={s.id}
              href={buildHref(current, { sourceType: s.id })}
              active={current.sourceType === s.id}
            >
              {s.label}
            </Chip>
          ))}
          <Chip
            href={buildHref(current, { bookmarked: current.bookmarked === '1' ? undefined : '1' })}
            active={current.bookmarked === '1'}
          >
            ★ 북마크
          </Chip>
          <Chip
            href={buildHref(current, { inactive: current.inactive === '1' ? undefined : '1' })}
            active={current.inactive === '1'}
          >
            출제 제외
          </Chip>
        </div>
        {years.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Chip href={buildHref(current, { year: undefined })} active={!current.year}>
              전체 연도
            </Chip>
            {years.map((y) => (
              <Chip key={y} href={buildHref(current, { year: String(y) })} active={current.year === String(y)}>
                {y}년
              </Chip>
            ))}
          </div>
        )}
      </div>

      <Link href={`/study?mode=random&${studyParams.toString()}`} className="btn btn-primary block text-center">
        이 조건으로 풀기
      </Link>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-[14px]" style={{ color: 'var(--text-dim)' }}>
          조건에 맞는 문제가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/questions/${r.id}`} className="card block p-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.year && r.round ? <Badge tone="accent">{`${r.year}년 ${r.round}회`}</Badge> : null}
                  <Badge>{CATEGORY_LABELS[r.category] ?? r.category}</Badge>
                  <Badge>{QUESTION_TYPE_LABELS[r.questionType] ?? r.questionType}</Badge>
                  <Badge tone={r.sourceType === 'past_exam' ? 'ok' : 'warn'}>{r.badge}</Badge>
                  {r.bookmarked && <Badge tone="warn">★</Badge>}
                  {!r.active && <Badge tone="bad">출제 제외</Badge>}
                </div>
                <p className="mt-1.5 text-[14.5px] leading-snug line-clamp-2">{r.question}</p>
                <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                  {r.attemptCount === 0
                    ? '미풀이'
                    : `${r.correctCount}/${r.attemptCount} 정답 · 연속 ${r.streak}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
