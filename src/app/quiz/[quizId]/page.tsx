import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import QuizEngine from '@/components/quiz/QuizEngine';

export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }> | { quizId: string };
}) {
  const resolvedParams = await params;
  const quizId = resolvedParams.quizId;
  const supabase = await createClient();

  const { data: questions, error } = await supabase
    .from('quiz_questions')
    .select('id, question_text, options, correct_answer, concept_tag, order_index')
    .eq('quiz_id', quizId)
    .order('order_index', { ascending: true });

  if (error || !questions || questions.length === 0) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 flex flex-col items-center justify-center p-6 md:p-16 font-sans">
      <QuizEngine quizId={quizId} questions={questions as any} />
    </div>
  );
}
