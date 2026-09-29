import { NextResponse } from 'next/server';
import { setMemo } from '@/server/attempts';
import { getQuestion } from '@/server/questions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getQuestion(id)) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const memo = typeof body.memo === 'string' ? body.memo.slice(0, 4000) : '';
  setMemo(id, memo);
  return NextResponse.json({ ok: true, memo });
}
