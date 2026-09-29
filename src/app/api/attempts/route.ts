import { NextResponse } from 'next/server';
import { submitAnswer } from '@/server/attempts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.questionId !== 'string' || !body.questionId) {
    return NextResponse.json({ error: 'questionId가 필요합니다.' }, { status: 400 });
  }

  const result = submitAnswer({
    questionId: body.questionId,
    userAnswer: typeof body.userAnswer === 'string' ? body.userAnswer : '',
    mode: typeof body.mode === 'string' ? body.mode : 'today',
    durationMs: Number(body.durationMs) || 0,
    reveal: Boolean(body.reveal),
    usedHint: Boolean(body.usedHint),
  });

  if (!result) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(result);
}
