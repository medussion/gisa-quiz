import { NextResponse } from 'next/server';
import { submitExam, type ExamAnswerInput } from '@/server/exam';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return NextResponse.json({ error: '잘못된 세션 id 입니다.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.answers) ? body.answers : [];
  const answers: ExamAnswerInput[] = raw
    .filter((a: unknown): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a: Record<string, unknown>) => ({
      questionId: String(a.questionId ?? ''),
      userAnswer: typeof a.userAnswer === 'string' ? a.userAnswer : '',
      durationMs: Number(a.durationMs) || 0,
    }))
    .filter((a: ExamAnswerInput) => a.questionId.length > 0);

  const result = submitExam(sessionId, answers);
  if (!result) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(result);
}
