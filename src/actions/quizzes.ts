'use server'

import { createClient } from '@/lib/supabase/server';
import { GeneratedQuiz } from '@/lib/gemini/schemas';

export async function saveGeneratedQuiz(quizData: GeneratedQuiz) {
  const supabase = await createClient();

  // 🚨 TEMPORARY AUTH BYPASS for local testing
  // We are skipping the getUser() check and leaving 'created_by' as null

  // 1. Insert the parent Quiz record
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      title: quizData.title,
      description: quizData.description,
      subject: quizData.subject,
      is_ai_generated: true,
      // created_by: user.id, <- Commented out until we build the login screen
    })
    .select('id')
    .single();

  if (quizError || !quiz) {
    console.error('Failed to create quiz:', quizError);
    throw new Error('Failed to create quiz record');
  }

  // 2. Map and batch-insert the generated questions
  const questionsToInsert = quizData.questions.map((q, index) => ({
    quiz_id: quiz.id,
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    concept_tag: q.concept_tag,
    order_index: index,
  }));

  const { error: questionsError } = await supabase
    .from('quiz_questions')
    .insert(questionsToInsert);

  if (questionsError) {
    console.error('Failed to save questions:', questionsError);
    throw new Error('Failed to save question records');
  }

  return { success: true, quizId: quiz.id };
}