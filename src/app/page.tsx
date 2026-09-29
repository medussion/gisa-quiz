import Link from 'next/link';
import { Badge } from '@/components/QuestionBody';
import { daysUntilExam, examConfig } from '@/lib/config';
import { STUDY_MODES } from '@/lib/constants';
import { getDashboard } from '@/server/stats';

export const dynamic = 'force-dynamic';

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-3 py-3">
      <p className="text-[11.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-bold tabular-nums leading-tight">{value}</p>
      {sub && (
        <p className="text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function HomePage() {
  const d = getDashboard();
  const dday = daysUntilExam();
  const maxSolved = Math.max(1, ...d.last7Days.map((x) => x.solved));
  const generatedCount = d.sourceBreakdown.find((s) => s.sourceType === 'generated')?.n ?? 0;
  const pastCount = d.sourceBreakdown.find((s) => s.sourceType === 'past_exam')?.n ?? 0;

  return (
    <div className="space-y-4">
      {/* D-day */}
      <section className="card flex items-center justify-between px-4 py-3.5">
        <div>
          <p className="text-[12px] font-semibold" style={{ color: 'var(--text-dim)' }}>
            시험일 {examConfig.examDate}
          </p>
          <p className="text-[26px] font-bold leading-tight">
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-DAY' : `D+${-dday}`}
          </p>
        </div>
        <div className="text-right text-[12px]" style={{ color: 'var(--text-dim)' }}>
          <p>
            문제 {d.totalQuestions}개 · 미풀이 {d.unseenCount}개
          </p>
          <p className="mt-0.5">
            합격 {examConfig.passScore}점 / {examConfig.questionCount}문항
          </p>
        </div>
      </section>

      {/* 오늘의 20문제 */}
      <Link href="/study?mode=today" className="btn btn-primary block text-center text-[16px]">
        오늘의 {examConfig.questionCount}문제 시작
      </Link>

      <section className="grid grid-cols-2 gap-2">
        <Stat
          label="오늘 푼 문제"
          value={String(d.todaySolved)}
          sub={`정답률 ${pct(d.todayAccuracy)}`}
        />
        <Stat
          label="전체 정답률"
          value={pct(d.overallAccuracy)}
          sub={`누적 ${d.overallAttempts}회 풀이`}
        />
        <Stat label="오답 문제" value={String(d.wrongPoolSize)} sub="한 번이라도 틀린 문제" />
        <Stat label="복습 예정" value={String(d.reviewDueCount)} sub="주기가 도래한 문제" />
      </section>

      {/* 학습 모드 */}
      <section>
        <h2 className="mb-2 px-1 text-[13px] font-bold" style={{ color: 'var(--text-dim)' }}>
          학습 모드
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {STUDY_MODES.filter((m) => m.id !== 'today').map((m) => (
            <Link key={m.id} href={`/study?mode=${m.id}`} className="card px-3 py-2.5">
              <p className="text-[14.5px] font-semibold">{m.label}</p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                {m.desc}
              </p>
            </Link>
          ))}
          <Link href="/exam" className="card px-3 py-2.5">
            <p className="text-[14.5px] font-semibold">모의고사</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
              {examConfig.questionCount}문제 · 정답 비공개
            </p>
          </Link>
        </div>
      </section>

      {/* 최근 7일 학습량 */}
      <section className="card p-4">
        <h2 className="text-[13px] font-bold">최근 7일 학습량</h2>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {d.last7Days.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                {day.solved || ''}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(day.solved ? 6 : 2, (day.solved / maxSolved) * 72)}px`,
                  background: day.solved ? 'var(--accent)' : 'var(--surface-2)',
                }}
                title={`${day.label}: ${day.solved}문제 중 ${day.correct}정답`}
              />
              <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 취약 영역 */}
      {d.weakCategories.length > 0 && (
        <section className="card p-4">
          <h2 className="text-[13px] font-bold">취약 영역</h2>
          <ul className="mt-2 space-y-2">
            {d.weakCategories.map((c) => (
              <li key={c.category}>
                <Link href={`/study?mode=random&category=${c.category}`} className="flex items-center gap-2">
                  <span className="w-[42%] shrink-0 truncate text-[13.5px]">{c.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(c.accuracy ?? 0) * 100}%`,
                        background: (c.accuracy ?? 0) < 0.6 ? 'var(--bad)' : 'var(--accent)',
                      }}
                    />
                  </span>
                  <span className="w-10 text-right text-[12px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                    {pct(c.accuracy)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 영역별 정답률 */}
      <section className="card p-4">
        <h2 className="text-[13px] font-bold">영역별 정답률</h2>
        <ul className="mt-2 space-y-1.5">
          {d.categoryStats.map((c) => (
            <li key={c.category} className="flex items-center gap-2 text-[13px]">
              <span className="w-[46%] shrink-0 truncate">{c.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(c.accuracy ?? 0) * 100}%`, background: 'var(--accent)' }}
                />
              </span>
              <span className="w-16 text-right tabular-nums text-[11.5px]" style={{ color: 'var(--text-dim)' }}>
                {pct(c.accuracy)} · {c.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 최근 모의고사 */}
      {d.recentExams.length > 0 && (
        <section className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold">최근 모의고사</h2>
            <Link href="/exam/history" className="text-[12.5px] font-medium" style={{ color: 'var(--accent)' }}>
              회차별 기록 →
            </Link>
          </div>
          <p className="mt-1.5 text-[13px]">
            {d.examCount}회 응시 · 종합 평균{' '}
            <b
              className="tabular-nums"
              style={{ color: (d.examAverageScore ?? 0) >= examConfig.passScore ? 'var(--ok)' : 'var(--bad)' }}
            >
              {d.examAverageScore}점
            </b>
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.recentExams.map((e) => (
              <li key={e.id}>
                <Link href={`/exam/${e.id}`} className="flex items-center justify-between text-[13.5px]">
                  <span style={{ color: 'var(--text-dim)' }}>{e.completedAt?.slice(0, 10)}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums" style={{ color: 'var(--text-dim)' }}>
                      {e.correctCount}/{e.questionCount}
                    </span>
                    <Badge tone={e.score >= examConfig.passScore ? 'ok' : 'bad'}>{e.score}점</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 데이터 구성 안내 */}
      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold">문제 구성</h2>
          <Link href="/questions/new" className="text-[12.5px] font-medium" style={{ color: 'var(--accent)' }}>
            + 문제 추가
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.sourceBreakdown.map((s) => (
            <Badge key={s.sourceType} tone={s.sourceType === 'past_exam' ? 'ok' : 'warn'}>
              {s.sourceType} {s.n}
            </Badge>
          ))}
        </div>
        {pastCount === 0 && (
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            아직 실제 기출/복원 문제가 없습니다. 지금 들어있는 문제는 앱 동작 확인용 샘플이며 기출이 아닙니다.
            <code className="mx-1">data/normalized/</code>에 기출 JSON을 넣고
            <code className="mx-1">npm run questions:import</code>를 실행하세요.
          </p>
        )}
        {generatedCount > 0 && (
          <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
            AI 변형 문제 {generatedCount}개가 포함되어 있습니다. 시험 직전에는 기출 ONLY 모드를 사용하세요.
          </p>
        )}
      </section>
    </div>
  );
}
