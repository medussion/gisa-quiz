import Link from 'next/link';
import QuestionRunner from '@/components/QuestionRunner';
import { examConfig } from '@/lib/config';
import { CATEGORY_LABELS, STUDY_MODES, STUDY_MODE_IDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function StudyPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const rawMode = one(sp.mode) ?? 'today';
  const mode = STUDY_MODE_IDS.includes(rawMode) ? rawMode : 'today';
  const modeInfo = STUDY_MODES.find((m) => m.id === mode);

  const count = Math.min(Math.max(Number(one(sp.count)) || examConfig.questionCount, 1), 100);
  const category = one(sp.category);
  const questionType = one(sp.questionType);
  const year = one(sp.year);
  const round = one(sp.round);
  const difficulty = one(sp.difficulty);
  const excludeGenerated = one(sp.excludeGenerated) === '1';

  const filters = {
    category,
    questionType,
    year: year ? Number(year) : undefined,
    round: round ? Number(round) : undefined,
    difficulty: difficulty ? Number(difficulty) : undefined,
    excludeGenerated,
  };

  const filterLabels = [
    category ? (CATEGORY_LABELS[category] ?? category) : null,
    year ? `${year}년` : null,
    round ? `${round}회` : null,
    difficulty ? `난이도 ${difficulty}` : null,
    excludeGenerated ? 'AI 문제 제외' : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[17px] font-bold">{modeInfo?.label ?? '학습'}</h1>
        <Link href="/" className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
          그만두기
        </Link>
      </div>
      {filterLabels.length > 0 && (
        <p className="px-1 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
          필터: {filterLabels.join(' · ')}
        </p>
      )}
      <QuestionRunner
        mode={mode}
        modeLabel={modeInfo?.label ?? '학습'}
        count={count}
        filters={filters}
      />
    </div>
  );
}
