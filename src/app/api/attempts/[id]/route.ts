import { NextResponse } from 'next/server';
import { overrideAttempt } from '@/server/attempts';

export const dynamic = 'force-dynamic';

/** SQL 등 자동 채점이 애매한 문제를 사용자가 정/오답으로 보정한다. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const attemptId = Number(id);
  if (!Number.isInteger(attemptId)) {
    return NextResponse.json({ error: '잘못된 attempt id 입니다.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.isCorrect !== 'boolean') {
    return NextResponse.json({ error: 'isCorrect(boolean)가 필요합니다.' }, { status: 400 });
  }

  const updated = overrideAttempt(attemptId, body.isCorrect);
  if (!updated) return NextResponse.json({ error: '풀이 기록을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ ok: true, ...updated });
}
