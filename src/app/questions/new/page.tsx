import QuestionForm from '@/components/QuestionForm';
import { recentUserAdded } from '@/server/authoring';

export const dynamic = 'force-dynamic';

export default function NewQuestionPage() {
  return <QuestionForm recent={recentUserAdded(5)} />;
}
