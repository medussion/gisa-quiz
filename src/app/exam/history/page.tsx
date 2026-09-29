import Link from 'next/link';
import { Badge } from '@/components/QuestionBody';
import { getExamHistory, getPastRoundStats } from '@/server/exam-history';

export const dynamic = 'force-dynamic';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '—';
  const min = Math.round(ms / 60000);
  return min < 1 ? '1분 미만' : `${min}분`;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card px-3 py-3">
      <p className="text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-bold leading-tight tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      {sub && (
        <p className="text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function ExamHistoryPage() {
  const h = getExamHistory();
  const pastRounds = getPastRoundStats();

  // 추세 그래프는 오래된 것부터 최대 12회
  const trend = [...h.runs].reverse().slice(-12);
  const maxScore = 100;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[17px] font-bold">모의고사 기록</h1>
        <Link href="/exam" className="text-[13px]" style={{ color: 'var(--accent)' }}>
          새 모의고사
        </Link>
      </div>

      {h.runs.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-[14px]" style={{ color: 'var(--text-dim)' }}>
            아직 완료한 모의고사가 없습니다.
          </p>
          <Link href="/exam" className="btn btn-primary mt-4 inline-block">
            첫 모의고사 보기
          </Link>
        </div>
      ) : (
        <>
          {/* 종합 */}
          <section className="grid grid-cols-2 gap-2">
            <Stat
              label="종합 평균"
              value={`${h.averageScore}점`}
              sub={`${h.runs.length}회 응시`}
              tone={(h.averageScore ?? 0) >= h.passScore ? 'var(--ok)' : 'var(--bad)'}
            />
            <Stat
              label="최근 5회 평균"
              value={`${h.recentAverageScore}점`}
              sub={
                h.delta === null
                  ? '직전 대비 —'
                  : `직전 대비 ${h.delta > 0 ? '+' : ''}${h.delta}점`
              }
              tone={(h.recentAverageScore ?? 0) >= h.passScore ? 'var(--ok)' : 'var(--bad)'}
            />
            <Stat label="최고 / 최저" value={`${h.bestScore} / ${h.worstScore}`} sub="점" />
            <Stat
              label="합격권 비율"
              value={`${Math.round((h.passRate ?? 0) * 100)}%`}
              sub={`${h.passCount}/${h.runs.length}회 · 기준 ${h.passScore}점`}
            />
          </section>

          <section className="card p-4">
            <p className="text-[13px]">
              누적 <b className="tabular-nums">{h.totalCorrect}</b> / {h.totalQuestions}문제 정답 ·{' '}
              <b className="tabular-nums">{Math.round((h.overallAccuracy ?? 0) * 100)}%</b>
            </p>
          </section>

          {/* 점수 추세 */}
          <section className="card p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-bold">점수 추세</h2>
              <span className="text-[11.5px] font-semibold" style={{ color: 'var(--ok)' }}>
                ---- 합격 {h.passScore}점
              </span>
            </div>
            <div className="relative mt-3 h-28">
              {/* 합격선 */}
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
                style={{ bottom: `${(h.passScore / maxScore) * 100}%`, borderColor: 'var(--ok)' }}
              />
              <div className="flex h-full items-end gap-1.5">
                {trend.map((r) => (
                  <div key={r.id} className="flex h-full flex-1 flex-col justify-end items-center gap-1">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                      {r.score}
                    </span>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.max(3, (r.score / maxScore) * 100)}%`,
                        background: r.passed ? 'var(--ok)' : 'var(--bad)',
                      }}
                      title={`${r.seq}회차 ${r.score}점`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex gap-1.5">
              {trend.map((r) => (
                <span
                  key={r.id}
                  className="flex-1 text-center text-[10px] tabular-nums"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {r.seq}
                </span>
              ))}
            </div>
          </section>

          {/* 영역별 평균 (모의고사 한정) */}
          {h.byCategory.length > 0 && (
            <section className="card p-4">
              <h2 className="text-[13px] font-bold">모의고사 영역별 평균</h2>
              <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                낮은 순. 모의고사에서 푼 문제만 집계합니다.
              </p>
              <ul className="mt-2 space-y-1.5">
                {h.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center gap-2 text-[13px]">
                    <span className="w-[46%] shrink-0 truncate">{c.label}</span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${c.accuracy * 100}%`,
                          background: c.accuracy >= 0.6 ? 'var(--ok)' : 'var(--bad)',
                        }}
                      />
                    </span>
                    <span
                      className="w-16 text-right text-[11.5px] tabular-nums"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {Math.round(c.accuracy * 100)}% · {c.correct}/{c.total}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 회차 목록 */}
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-bold" style={{ color: 'var(--text-dim)' }}>
              회차별 기록
            </h2>
            <ul className="space-y-2">
              {h.runs.map((r) => (
                <li key={r.id}>
                  <Link href={`/exam/${r.id}`} className="card flex items-center gap-3 p-3.5">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-lg text-[13px] font-bold tabular-nums"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}
                    >
                      {r.seq}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold tabular-nums">
                        {r.score}점
                        <span className="ml-2 text-[12.5px] font-normal" style={{ color: 'var(--text-dim)' }}>
                          {r.correctCount}/{r.questionCount} 정답
                        </span>
                      </span>
                      <span className="block text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                        {fmtDateTime(r.completedAt)} · {fmtDuration(r.durationMs)}
                      </span>
                    </span>
                    <Badge tone={r.passed ? 'ok' : 'bad'}>{r.passed ? '합격권' : '불합격권'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* 기출 연도·회차별 정답률 */}
      {pastRounds.length > 0 && (
        <section className="card p-4">
          <h2 className="text-[13px] font-bold">기출 회차별 정답률</h2>
          <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
            실제 기출 문제를 푼 기록 기준입니다.
          </p>
          <ul className="mt-2 space-y-1.5">
            {pastRounds.map((r) => (
              <li key={`${r.year}-${r.round}`} className="flex items-center gap-2 text-[13px]">
                <Link
                  href={`/study?mode=past_only&year=${r.year}&round=${r.round}&count=30`}
                  className="w-[30%] shrink-0 truncate underline-offset-2 hover:underline"
                >
                  {r.year}년 {r.round}회
                </Link>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(r.accuracy ?? 0) * 100}%`,
                      background: (r.accuracy ?? 0) >= 0.6 ? 'var(--ok)' : 'var(--bad)',
                    }}
                  />
                </span>
                <span className="w-20 text-right text-[11.5px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                  {r.accuracy === null ? '미풀이' : `${Math.round(r.accuracy * 100)}%`} · {r.total}문제
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
