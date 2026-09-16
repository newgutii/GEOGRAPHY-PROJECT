import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import HeroMetrics from '@/components/debrief/HeroMetrics';
import AiBlindSpot from '@/components/debrief/AiBlindSpot';
import AiBlindSpotSkeleton from '@/components/debrief/AiBlindSpotSkeleton';
import ErrorLedger from '@/components/debrief/ErrorLedger';

export default async function DebriefPage({ params }: { params: Promise<{ attemptId: string }> | { attemptId: string } }) {
  const resolvedParams = await params;
  const supabase = await createClient();
  
  const { data: attempt, error } = await supabase
    .from('user_attempts')
    .select(`
      *,
      quiz:quizzes(title),
      answers:user_answers(
        id,
        is_correct,
        time_taken_ms,
        selected_option,
        question:quiz_questions(question_text, correct_answer, concept_tag)
      ),
      ghost:user_attempts!ghost_reference_id(answers_per_second)
    `)
    .eq('id', resolvedParams.attemptId)
    .single();

  if (error || !attempt) {
    return notFound();
  }

  const accuracy = attempt.total_questions > 0 
    ? (attempt.score / attempt.total_questions) * 100 
    : 0;
    
  const ghostDelta = attempt.ghost 
    ? attempt.answers_per_second - attempt.ghost.answers_per_second 
    : null;

  const missedAnswers = (attempt.answers || []).filter((a: any) => !a.is_correct);
  const missedTags = Array.from(
    new Set(
      missedAnswers
        .map((a: any) => (Array.isArray(a.question) ? a.question[0]?.concept_tag : a.question?.concept_tag))
        .filter(Boolean)
    )
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 p-6 md:p-16 md:pt-24 font-sans selection:bg-purple-500/30">
      <div className="max-w-5xl mx-auto space-y-24">
        
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">Debrief</h1>
          <p className="text-zinc-500 text-lg md:text-xl font-medium tracking-tight">
            {attempt.quiz?.title || 'Custom Quiz'}
          </p>
        </header>

        <HeroMetrics 
          accuracy={accuracy} 
          aps={attempt.answers_per_second} 
          ghostDelta={ghostDelta} 
        />

        {missedTags.length > 0 && (
          <Suspense fallback={<AiBlindSpotSkeleton />}>
            <AiBlindSpot missedTags={missedTags as string[]} />
          </Suspense>
        )}

        <ErrorLedger answers={attempt.answers} />

      </div>
    </div>
  );
}
