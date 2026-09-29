import { NextResponse } from 'next/server';
import { selectQuestions, toDTO } from '@/server/questions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = typeof body.mode === 'string' ? body.mode : 'today';
  const count = Math.min(Math.max(Number(body.count) || 20, 1), 100);

  const picked = selectQuestions({
    mode,
    count,
    category: body.category || undefined,
    questionType: body.questionType || undefined,
    sourceType: body.sourceType || undefined,
    year: body.year ? Number(body.year) : undefined,
    round: body.round ? Number(body.round) : undefined,
    difficulty: body.difficulty ? Number(body.difficulty) : undefined,
    pastOnly: Boolean(body.pastOnly),
    excludeGenerated: Boolean(body.excludeGenerated),
  });

  return NextResponse.json({ mode, questions: picked.map(toDTO) });
}
