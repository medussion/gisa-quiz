import { CATEGORY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/constants';
import type { QuestionDTO } from '@/lib/types';

export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'ok' | 'bad' | 'warn' | 'accent';
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--surface-2)', color: 'var(--text-dim)', borderColor: 'var(--border)' },
    ok: { background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'transparent' },
    bad: { background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'transparent' },
    warn: { background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'transparent' },
    accent: { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', borderColor: 'transparent' },
  };
  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

export function sourceTone(sourceType: string): 'ok' | 'warn' | 'default' {
  if (sourceType === 'past_exam') return 'ok';
  if (sourceType === 'generated' || sourceType === 'sample') return 'warn';
  return 'default';
}

export function QuestionMeta({ q }: { q: QuestionDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {q.year && q.round ? <Badge tone="accent">{`${q.year}년 ${q.round}회`}</Badge> : null}
      <Badge>{CATEGORY_LABELS[q.category] ?? q.category}</Badge>
      <Badge>{QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}</Badge>
      <Badge tone={sourceTone(q.sourceType)}>{q.badge}</Badge>
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return <pre className="code-block mt-3">{code}</pre>;
}

export function QuestionBody({ q }: { q: QuestionDTO }) {
  return (
    <>
      <p className="mt-3 text-[16.5px] leading-[1.65] whitespace-pre-wrap">{q.question}</p>
      {q.code ? <CodeBlock code={q.code} /> : null}
      {q.image ? (
        // 출처에 코드가 글자가 아니라 그림으로만 올라온 문항이 있다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.image}
          alt="문제에 딸린 코드 또는 그림"
          className="mt-3 w-full rounded-lg border"
          style={{ borderColor: 'var(--border)', background: '#fff' }}
        />
      ) : null}
      {q.choices ? (
        <ol className="mt-3 space-y-1.5 text-[15.5px] leading-relaxed">
          {q.choices.map((choice, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold" style={{ color: 'var(--text-dim)' }}>
                {i + 1}.
              </span>
              <span>{choice}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}
