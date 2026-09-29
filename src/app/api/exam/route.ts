import { NextResponse } from 'next/server';
import { examConfig } from '@/lib/config';
import { startExam } from '@/server/exam';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || examConfig.questionCount, 1), 100);
  const result = startExam(count, Boolean(body.pastOnly));

  if (result.questions.length === 0) {
    return NextResponse.json({ error: '출제할 문제가 없습니다. 먼저 문제를 import 하세요.' }, { status: 400 });
  }
  return NextResponse.json(result);
}
