import { NextResponse } from 'next/server';
import { parseQuestionInput } from '@/lib/question-input';
import { createQuestion } from '@/server/authoring';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const result = createQuestion(parseQuestionInput(body as Record<string, unknown>));
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
