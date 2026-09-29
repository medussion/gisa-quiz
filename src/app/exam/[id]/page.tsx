import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExamResultView from '@/components/ExamResultView';
import { getExamResult } from '@/server/exam';

export const dynamic = 'force-dynamic';

export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) notFound();

  const result = getExamResult(sessionId);
  if (!result) {
    return (
      <div className="card p-5">
        <p className="text-[15px]">아직 제출되지 않았거나 존재하지 않는 모의고사입니다.</p>
        <Link href="/exam" className="btn mt-4 inline-block">
          모의고사로
        </Link>
      </div>
    );
  }

  return <ExamResultView result={result} />;
}
