import ExamRunner from '@/components/ExamRunner';
import { examConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function ExamPage() {
  return <ExamRunner defaultCount={examConfig.questionCount} passScore={examConfig.passScore} />;
}
