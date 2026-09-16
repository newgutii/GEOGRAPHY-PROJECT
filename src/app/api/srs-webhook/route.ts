import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateNextReview } from '@/lib/srs/algorithm';

export async function POST(req: Request) {
  try {
    const { attempt_id } = await req.json();

    if (!attempt_id) {
      return NextResponse.json({ error: 'attempt_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: attempt, error: attemptError } = await supabase
      .from('user_attempts')
      .select('user_id')
      .eq('id', attempt_id)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }

    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select(`
        is_correct,
        question:quiz_questions ( concept_tag )
      `)
      .eq('attempt_id', attempt_id);

    if (answersError || !answers) {
      return NextResponse.json({ error: 'Answers not found' }, { status: 404 });
    }

    const conceptTags = Array.from(
      new Set(
        answers
          .map((a: any) => (Array.isArray(a.question) ? a.question[0]?.concept_tag : a.question?.concept_tag))
          .filter(Boolean)
      )
    );
    
    const { data: currentLedger, error: ledgerError } = await supabase
      .from('spaced_repetition_ledger')
      .select('*')
      .eq('user_id', attempt.user_id)
      .in('concept_tag', conceptTags);

    if (ledgerError) {
      throw new Error('Failed to fetch existing ledger records');
    }

    const ledgerMap = new Map((currentLedger || []).map((item: any) => [item.concept_tag, item]));
    
    const updatesMap = new Map();

    for (const answer of answers) {
      const q: any = Array.isArray(answer.question) ? answer.question[0] : answer.question;
      const tag = q?.concept_tag;
      if (!tag) continue;
      const isCorrect = answer.is_correct;
      
      const prev = updatesMap.get(tag) || ledgerMap.get(tag) || {
        ease_factor: 2.50,
        interval_days: 0,
        consecutive_correct: 0,
      };

      const result = calculateNextReview(isCorrect, {
        easeFactor: prev.ease_factor || 2.50,
        intervalDays: prev.interval_days || 0,
        consecutiveCorrect: prev.consecutive_correct || 0,
      });

      updatesMap.set(tag, {
        user_id: attempt.user_id,
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
      const { error: upsertError } = await supabase
        .from('spaced_repetition_ledger')
        .upsert(upsertPayload, { 
          onConflict: 'user_id, concept_tag' 
        });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw new Error('Failed to update SRS ledger');
      }
    }

    return NextResponse.json({ 
      success: true, 
      conceptsProcessed: upsertPayload.length 
    });
    
  } catch (error) {
    console.error('SRS Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
