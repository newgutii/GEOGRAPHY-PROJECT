'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateNextReview } from '@/lib/srs/algorithm';

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

  // Update Spaced Repetition Ledger
  try {
    const questionIds = answers.map(a => a.questionId);
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('id, concept_tag')
      .in('id', questionIds);

    const questionMap = new Map((questions || []).map((q: any) => [q.id, q.concept_tag]));
    const conceptTags = Array.from(new Set(answers.map(a => questionMap.get(a.questionId)).filter(Boolean)));

    if (conceptTags.length > 0) {
      const { data: currentLedger } = await supabase
        .from('spaced_repetition_ledger')
        .select('*')
        .eq('user_id', user.id)
        .in('concept_tag', conceptTags);

      const ledgerMap = new Map((currentLedger || []).map((item: any) => [item.concept_tag, item]));
      const updatesMap = new Map();

      for (const ans of answers) {
        const tag = questionMap.get(ans.questionId);
        if (!tag) continue;

        const prev = updatesMap.get(tag) || ledgerMap.get(tag) || {
          ease_factor: 2.50,
          interval_days: 0,
          consecutive_correct: 0,
        };

        const result = calculateNextReview(ans.isCorrect, {
          easeFactor: prev.ease_factor || 2.50,
          intervalDays: prev.interval_days || 0,
          consecutiveCorrect: prev.consecutive_correct || 0,
        });

        updatesMap.set(tag, {
          user_id: user.id,
          concept_tag: tag,
          state: result.state,
          next_review_date: result.nextReviewDate.toISOString(),
          ease_factor: result.easeFactor,
          interval_days: result.intervalDays,
          consecutive_correct: result.consecutiveCorrect,
          last_reviewed_at: new Date().toISOString(),
        });
      }

      const upsertPayload = Array.from(updatesMap.values());
      if (upsertPayload.length > 0) {
        await supabase
          .from('spaced_repetition_ledger')
          .upsert(upsertPayload, { onConflict: 'user_id, concept_tag' });
      }
    }
  } catch (srsErr) {
    console.warn('SRS update caught:', srsErr);
  }

  revalidatePath('/dashboard'); 
  
  return { 
    success: true, 
    attemptId: attempt.id,
    metrics: { score, answersPerSecond }
  };
}
