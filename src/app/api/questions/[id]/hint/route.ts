import { NextResponse } from 'next/server';
import { getHint } from '@/server/questions';

export const dynamic = 'force-dynamic';

/** 정답은 내보내지 않고 힌트 문구만 돌려준다. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hint = getHint(id);
  if (!hint) return NextResponse.json({ error: '문제를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(hint);
}
