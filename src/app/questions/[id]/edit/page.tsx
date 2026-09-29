import { notFound } from 'next/navigation';
import QuestionForm from '@/components/QuestionForm';
import { getQuestionForEdit } from '@/server/authoring';

export const dynamic = 'force-dynamic';

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initial = getQuestionForEdit(id);
  if (!initial) notFound();

  const { sourceFile, ...values } = initial;
  return <QuestionForm mode="edit" questionId={id} sourceFile={sourceFile} initial={values} />;
}
