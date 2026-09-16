'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type SubmitAttemptPayload = {
  quizId: string;
  startTime: string;
  endTime: string;
  ghostReferenceId?: string;
  answers: Array<{
    questionId: string;
    isCorrect: boolean;
    timeTakenMs: number;
    selectedOption: string;
  }>;
};

export async function submitQuizAttempt(payload: SubmitAttemptPayload) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { quizId, startTime, endTime, ghostReferenceId, answers } = payload;
  
  const totalQuestions = answers.length;
  const score = answers.filter(a => a.isCorrect).length;
  
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const totalTimeSeconds = (end - start) / 1000;
  
  const answersPerSecond = totalTimeSeconds > 0 
    ? Number((totalQuestions / totalTimeSeconds).toFixed(2)) 
    : 0;

  const { data: attempt, error: attemptError } = await supabase
    .from('user_attempts')
    .insert({
      user_id: user.id,
      quiz_id: quizId,
      start_time: startTime,
      end_time: endTime,
      score,
      total_questions: totalQuestions,
      answers_per_second: answersPerSecond,
      ghost_reference_id: ghostReferenceId || null,
    })
    .select('id')
    .single();

  if (attemptError || !attempt) {
    console.error('Failed to save attempt:', attemptError);
    throw new Error('Failed to save attempt record');
  }

  const answersToInsert = answers.map(answer => ({
    attempt_id: attempt.id,
    question_id: answer.questionId,
    is_correct: answer.isCorrect,
    time_taken_ms: answer.timeTakenMs,
    selected_option: answer.selectedOption,
  }));

  const { error: answersError } = await supabase
    .from('user_answers')
    .insert(answersToInsert);

  if (answersError) {
    console.error('Failed to save granular answers:', answersError);
    throw new Error('Failed to save individual answer records');
  }

  revalidatePath('/dashboard'); 
  
  return { 
    success: true, 
    attemptId: attempt.id,
    metrics: { score, answersPerSecond }
  };
}
