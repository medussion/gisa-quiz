import { NextResponse } from 'next/server';
import { parseQuestionInput } from '@/lib/question-input';
import { updateQuestion } from '@/server/authoring';

export const dynamic = 'force-dynamic';

/** 문제 수정. id는 바꾸지 않는다 (풀이 이력이 id로 묶여 있다). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const input = parseQuestionInput(body as Record<string, unknown>);
  const result = updateQuestion(id, { ...input, id });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
