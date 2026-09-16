const fs = require('fs');
const path = require('path');

const files = {
    'src/lib/gemini/schemas.ts': `import { z } from 'zod';

export const QuizQuestionSchema = z.object({
  question_text: z.string().describe('The text of the multiple choice question.'),
  options: z.array(z.string()).length(4).describe('Exactly four possible answers for the question. Ensure they are distinct and plausible.'),
  correct_answer: z.string().describe('The exact string of the correct answer, which must perfectly match one of the items in the options array.'),
  concept_tag: z.string().describe('A concise, abstract tag representing the core concept tested (e.g., "React Hooks", "90s BMX Frames"). Must be highly specific so spaced repetition can track this exact knowledge node.'),
});

export const GeneratedQuizSchema = z.object({
  title: z.string().describe('A catchy, relevant title for the generated quiz.'),
  description: z.string().describe('A short, engaging description of what the quiz covers.'),
  subject: z.string().describe('The overarching subject area (e.g., "History", "Web Development", "Pop Culture").'),
  questions: z.array(QuizQuestionSchema).describe('The list of generated questions for the quiz.'),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type GeneratedQuiz = z.infer<typeof GeneratedQuizSchema>;
`,
    'src/app/api/generate/route.ts': `import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GeneratedQuizSchema } from '@/lib/gemini/schemas';

const ai = new GoogleGenAI({}); 

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const jsonSchema = zodToJsonSchema(GeneratedQuizSchema, 'GeneratedQuizSchema').definitions?.GeneratedQuizSchema;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [{ text: \`Create a custom quiz based on this request: "\${prompt}"\` }]
        }
      ],
      config: {
        systemInstruction: 'You are an expert educational AI. Generate high-quality, engaging multiple-choice quizzes. Ensure all options are plausible but only one is definitively correct. Keep concept_tags concise and highly relevant to the core knowledge being tested so they can be effectively tracked in our Spaced Repetition System (SRS).',
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as any,
        temperature: 0.7,
      }
    });

    const rawData = JSON.parse(response.text() || '{}');
    const validatedQuiz = GeneratedQuizSchema.parse(rawData);

    return NextResponse.json(validatedQuiz);
  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json({ error: 'Failed to generate custom quiz' }, { status: 500 });
  }
}
`,
    'src/actions/attempts.ts': `'use server'

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
`,
    'src/app/dashboard/debrief/[attemptId]/page.tsx': `import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import HeroMetrics from '@/components/debrief/HeroMetrics';
import AiBlindSpot from '@/components/debrief/AiBlindSpot';
import AiBlindSpotSkeleton from '@/components/debrief/AiBlindSpotSkeleton';
import ErrorLedger from '@/components/debrief/ErrorLedger';

export default async function DebriefPage({ params }: { params: { attemptId: string } }) {
  const supabase = await createClient();
  
  const { data: attempt, error } = await supabase
    .from('user_attempts')
    .select(\`
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
    \`)
    .eq('id', params.attemptId)
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

  const missedAnswers = attempt.answers.filter((a: any) => !a.is_correct);
  const missedTags = Array.from(new Set(missedAnswers.map((a: any) => a.question.concept_tag)));

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
`,
    'src/components/debrief/HeroMetrics.tsx': `export default function HeroMetrics({ 
  accuracy, 
  aps, 
  ghostDelta 
}: { 
  accuracy: number; 
  aps: number; 
  ghostDelta: number | null; 
}) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6">
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Accuracy</h2>
        <p className="text-6xl md:text-7xl font-black tracking-tighter text-white">
          {Math.round(accuracy)}<span className="text-3xl text-zinc-600 ml-1">%</span>
        </p>
      </div>
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Pace</h2>
        <div className="flex items-baseline space-x-2">
          <p className="text-6xl md:text-7xl font-black tracking-tighter text-white">
            {aps.toFixed(2)}
          </p>
          <span className="text-xl text-zinc-600 font-medium tracking-tight">APS</span>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Ghost Delta</h2>
        {ghostDelta !== null ? (
          <p className={\`text-6xl md:text-7xl font-black tracking-tighter \${ghostDelta >= 0 ? 'text-emerald-400' : 'text-rose-500'}\`}>
            {ghostDelta > 0 ? '+' : ''}{ghostDelta.toFixed(2)}
          </p>
        ) : (
          <p className="text-6xl md:text-7xl font-black tracking-tighter text-zinc-700">--</p>
        )}
      </div>
    </section>
  );
}
`,
    'src/components/debrief/AiBlindSpot.tsx': `import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export default async function AiBlindSpot({ missedTags }: { missedTags: string[] }) {
  let insight = "Keep practicing to identify and eliminate your blind spots.";
  
  if (missedTags.length > 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: \`The user just took a quiz and missed questions related to these concepts: \${missedTags.join(', ')}. Write a brief 2-3 sentence insight identifying their blind spot and encouraging them. Keep it direct, professional, and slightly analytical. Return plain text only.\`,
      });
      insight = response.text() || insight;
    } catch (error) {
      console.error("Failed to generate AI Blind Spot insight:", error);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-zinc-900/40 p-8 md:p-10 ring-1 ring-white/5">
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl space-y-4">
          <h3 className="text-xs flex items-center gap-2 uppercase tracking-widest text-purple-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            AI Blind Spot
          </h3>
          <p className="text-lg md:text-xl leading-relaxed text-zinc-300 font-medium tracking-tight">
            {insight}
          </p>
        </div>
        <button className="whitespace-nowrap bg-zinc-100 text-[#09090b] px-7 py-3 rounded-full text-sm font-bold tracking-wide hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all">
          Drill This Now
        </button>
      </div>
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
    </section>
  );
}
`,
    'src/components/debrief/AiBlindSpotSkeleton.tsx': `export default function AiBlindSpotSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-zinc-900/20 p-8 md:p-10 ring-1 ring-white/5">
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl space-y-6 w-full">
          <h3 className="text-xs flex items-center gap-2 uppercase tracking-widest text-zinc-500 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500/50 animate-ping" />
            Synthesizing AI Insight...
          </h3>
          <div className="space-y-3 animate-pulse">
            <div className="h-5 bg-zinc-800/60 rounded-md w-full" />
            <div className="h-5 bg-zinc-800/60 rounded-md w-[85%]" />
            <div className="h-5 bg-zinc-800/60 rounded-md w-[60%]" />
          </div>
        </div>
        <div className="w-[140px] h-[44px] bg-zinc-800/50 rounded-full animate-pulse" />
      </div>
    </section>
  );
}
`,
    'src/components/debrief/ErrorLedger.tsx': `export default function ErrorLedger({ answers }: { answers: any[] }) {
  return (
    <section className="pt-8">
      <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-10">Error Ledger</h3>
      <div className="flex flex-col gap-10">
        {answers.map((answer) => (
          <div key={answer.id} className="flex flex-col md:flex-row md:items-start justify-between gap-6 group">
            <div className="flex-1 max-w-3xl">
              <p className="text-zinc-100 text-base md:text-lg font-medium mb-3 leading-snug">
                {answer.question.question_text}
              </p>
              <div className="flex items-center gap-3 text-sm tracking-wide">
                <span className={answer.is_correct ? 'text-zinc-500' : 'text-rose-500 font-semibold'}>
                  {answer.selected_option}
                </span>
                {!answer.is_correct && (
                  <>
                    <span className="text-zinc-700">/</span>
                    <span className="text-emerald-400 font-semibold">
                      {answer.question.correct_answer}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="w-full md:w-48 h-12 flex-shrink-0 bg-zinc-900/30 rounded flex items-center justify-center text-[10px] text-zinc-700 uppercase tracking-widest font-bold group-hover:bg-zinc-900/50 transition-colors">
              [ Tilt Sparkline ]
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
`,
    'src/app/api/lifeline/route.ts': `import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { question_text, concept_tag } = await req.json();

    if (!question_text || !concept_tag) {
      return NextResponse.json({ error: 'Missing question or concept tag' }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: \`Question: "\${question_text}"\\nConcept Focus: "\${concept_tag}"\`,
      config: {
        systemInstruction: "You are an expert tutor. Provide a brief, 1-2 sentence hint, mnemonic, or contextual clue for the provided question. You MUST NOT reveal the correct answer directly. Keep the tone encouraging but concise.",
        temperature: 0.7,
      }
    });

    const hint = response.text();

    return NextResponse.json({ hint });
  } catch (error) {
    console.error('Lifeline generation error:', error);
    return NextResponse.json({ error: 'Failed to generate lifeline hint' }, { status: 500 });
  }
}
`,
    'src/components/quiz/QuizEngine.tsx': `'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { submitQuizAttempt, SubmitAttemptPayload } from '@/actions/attempts';

type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  concept_tag: string;
};

export default function QuizEngine({ 
  quizId, 
  questions, 
  ghostReferenceId 
}: { 
  quizId: string;
  questions: Question[];
  ghostReferenceId?: string;
}) {
  const router = useRouter();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<SubmitAttemptPayload['answers']>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  
  const [startTime] = useState<string>(() => new Date().toISOString());
  
  const questionStartTimeRef = useRef<number>(0);
  
  const currentQuestion = questions[currentIndex];
  
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    setHint(null);
  }, [currentIndex]);
  
  const handleOptionSelect = async (selectedOption: string) => {
    if (isSubmitting) return;
    
    const timeTakenMs = Date.now() - questionStartTimeRef.current;
    const isCorrect = selectedOption === currentQuestion.correct_answer;
    
    const newAnswers = [
      ...answers, 
      {
        questionId: currentQuestion.id,
        isCorrect,
        timeTakenMs,
        selectedOption,
      }
    ];
    
    setAnswers(newAnswers);
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsSubmitting(true);
      
      const payload: SubmitAttemptPayload = {
        quizId,
        startTime,
        endTime: new Date().toISOString(),
        ghostReferenceId,
        answers: newAnswers,
      };
      
      try {
        const result = await submitQuizAttempt(payload);
        if (result.success) {
          router.push(\`/dashboard/debrief/\${result.attemptId}\`);
        }
      } catch (error) {
        console.error("Submission failed:", error);
        setIsSubmitting(false); 
      }
    }
  };
  
  const handleLifeline = async () => {
    if (isLoadingHint || hint) return;
    
    setIsLoadingHint(true);
    try {
      const res = await fetch('/api/lifeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: currentQuestion.question_text,
          concept_tag: currentQuestion.concept_tag,
        })
      });
      const data = await res.json();
      if (data.hint) setHint(data.hint);
    } catch (error) {
      console.error("Failed to fetch hint", error);
    } finally {
      setIsLoadingHint(false);
    }
  };
  
  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-6">
        <div className="h-10 w-10 rounded-full border-2 border-zinc-700 border-t-zinc-100 animate-spin" />
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase animate-pulse">
          Calculating Run Metrics...
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto w-full space-y-10">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase">
          Question {currentIndex + 1} <span className="text-zinc-700">/ {questions.length}</span>
        </p>
        <button 
          onClick={handleLifeline}
          disabled={isLoadingHint || !!hint}
          className="text-[10px] font-bold tracking-widest uppercase px-4 py-2 rounded-full bg-zinc-900 text-purple-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors ring-1 ring-white/5"
        >
          {isLoadingHint ? 'Connecting...' : hint ? 'Lifeline Active' : 'AI Lifeline'}
        </button>
      </div>
      <h2 className="text-2xl md:text-3xl font-medium leading-snug text-zinc-100 tracking-tight">
        {currentQuestion.question_text}
      </h2>
      {hint && (
        <div className="bg-purple-900/20 border border-purple-500/20 p-5 rounded-2xl text-purple-200 text-sm leading-relaxed shadow-inner">
          <span className="font-bold uppercase tracking-widest text-[10px] text-purple-400 block mb-1">
            Tutor Insight
          </span> 
          {hint}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 pt-4">
        {currentQuestion.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleOptionSelect(option)}
            className="text-left w-full p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all font-medium text-lg active:scale-[0.98]"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
`,
    'src/lib/srs/algorithm.ts': `export type MemoryState = 'New' | 'Learning' | 'Review' | 'Mastered';

export interface SRSData {
  easeFactor: number;
  intervalDays: number;
  consecutiveCorrect: number;
}

export interface SRSResult extends SRSData {
  nextReviewDate: Date;
  state: MemoryState;
}

export function calculateNextReview(
  isCorrect: boolean,
  prev: SRSData
): SRSResult {
  let { easeFactor, intervalDays, consecutiveCorrect } = prev;

  if (isCorrect) {
    consecutiveCorrect += 1;
    if (consecutiveCorrect === 1) {
      intervalDays = 1;
    } else if (consecutiveCorrect === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    easeFactor = Math.min(2.5, easeFactor + 0.1);
  } else {
    consecutiveCorrect = 0;
    intervalDays = 1; 
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  }

  let state: MemoryState = 'Learning';
  if (intervalDays >= 21) {
    state = 'Mastered';
  } else if (intervalDays > 1) {
    state = 'Review';
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    consecutiveCorrect,
    nextReviewDate,
    state
  };
}
`,
    'src/app/api/srs-webhook/route.ts': `import { NextResponse } from 'next/server';
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
      .select(\`
        is_correct,
        question:quiz_questions ( concept_tag )
      \`)
      .eq('attempt_id', attempt_id);

    if (answersError || !answers) {
      return NextResponse.json({ error: 'Answers not found' }, { status: 404 });
    }

    const conceptTags = Array.from(new Set(answers.map((a: any) => a.question.concept_tag)));
    
    const { data: currentLedger, error: ledgerError } = await supabase
      .from('spaced_repetition_ledger')
      .select('*')
      .eq('user_id', attempt.user_id)
      .in('concept_tag', conceptTags);

    if (ledgerError) {
      throw new Error('Failed to fetch existing ledger records');
    }

    const ledgerMap = new Map(currentLedger?.map(item => [item.concept_tag, item]) || []);
    
    const updatesMap = new Map();

    for (const answer of answers) {
      const tag = answer.question.concept_tag;
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
`,
    'src/actions/quizzes.ts': `'use server'

import { createClient } from '@/lib/supabase/server';
import { GeneratedQuiz } from '@/lib/gemini/schemas';

export async function saveGeneratedQuiz(quizData: GeneratedQuiz) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      title: quizData.title,
      description: quizData.description,
      subject: quizData.subject,
      is_ai_generated: true,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (quizError || !quiz) {
    console.error('Failed to create quiz:', quizError);
    throw new Error('Failed to create quiz record');
  }

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
`,
    'src/components/dashboard/CustomQuizGenerator.tsx': `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveGeneratedQuiz } from '@/actions/quizzes';
import { GeneratedQuiz } from '@/lib/gemini/schemas';

export default function CustomQuizGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error('Failed to generate quiz JSON');
      
      const generatedQuiz: GeneratedQuiz = await response.json();

      const result = await saveGeneratedQuiz(generatedQuiz);
      
      if (result.success && result.quizId) {
        router.push(\`/quiz/\${result.quizId}\`);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative group">
      <div 
        className={\`absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-600 rounded-2xl blur-xl opacity-20 transition-all duration-1000 
        \${isGenerating ? 'opacity-80 animate-pulse duration-500 scale-105' : 'group-hover:opacity-40 group-hover:duration-200'}\`} 
      />
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isGenerating}
        placeholder="What are we studying today?"
        autoFocus
        className="relative w-full bg-[#0A0A0A] text-zinc-100 placeholder-zinc-700 text-3xl md:text-5xl font-black tracking-tighter px-8 py-10 md:py-14 rounded-2xl border border-zinc-800/80 focus:outline-none focus:border-purple-500/50 transition-colors disabled:bg-[#050505] shadow-2xl"
      />
      {isGenerating && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-3 text-purple-400">
          <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline-block">Synthesizing Nodes</span>
        </div>
      )}
    </form>
  );
}
`,
    'src/app/dashboard/page.tsx': `import CustomQuizGenerator from '@/components/dashboard/CustomQuizGenerator';
import Link from 'next/link';

export default function DashboardPage() {
  const placeholderCards = [
    { 
      title: 'Daily Mix', 
      desc: 'Algorithmically curated review', 
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 
      href: '/dashboard/daily-mix' 
    },
    { 
      title: 'World Capitals', 
      desc: 'Geography fundamentals', 
      color: 'bg-zinc-900/50 text-zinc-300 border-zinc-800/80', 
      href: '#' 
    },
    { 
      title: 'React Hooks', 
      desc: 'Frontend state management', 
      color: 'bg-zinc-900/50 text-zinc-300 border-zinc-800/80', 
      href: '#' 
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 flex flex-col items-center justify-center p-6 md:p-16">
      <div className="max-w-4xl w-full space-y-24">
        <div className="flex flex-col items-center w-full mt-10 md:mt-0">
          <CustomQuizGenerator />
        </div>
        <div className="pt-12 border-t border-zinc-800/50">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-6 text-center">
            Or Jump Back Into The Matrix
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {placeholderCards.map((card, idx) => (
              <Link 
                key={idx} 
                href={card.href} 
                className={\`p-6 rounded-2xl border hover:-translate-y-1 transition-all duration-300 \${card.color}\`}
              >
                <h4 className="text-lg font-bold tracking-tight mb-1">{card.title}</h4>
                <p className="text-xs font-medium tracking-wide opacity-70 uppercase">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`,
    'src/app/dashboard/daily-mix/page.tsx': `import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GoogleGenAI } from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GeneratedQuizSchema } from '@/lib/gemini/schemas';
import { saveGeneratedQuiz } from '@/actions/quizzes';
import Link from 'next/link';

export default async function DailyMixPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }

  const { data: dueConcepts, error: ledgerError } = await supabase
    .from('spaced_repetition_ledger')
    .select('concept_tag')
    .eq('user_id', user.id)
    .lte('next_review_date', new Date().toISOString())
    .order('ease_factor', { ascending: true })
    .limit(10);

  if (ledgerError) {
    console.error('Failed to fetch SRS ledger:', ledgerError);
    throw new Error('Failed to load Daily Mix data');
  }

  if (!dueConcepts || dueConcepts.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30">
        <div className="space-y-6 text-center max-w-lg">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4 ring-1 ring-emerald-500/20">
            <span className="text-3xl text-emerald-400">✧</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white">Memory Optimized</h1>
          <p className="text-zinc-400 text-lg font-medium leading-relaxed">
            There are no concepts due for review today. Your neural pathways are fully fortified.
          </p>
          <div className="pt-8">
            <Link 
              href="/dashboard" 
              className="inline-block px-8 py-3 rounded-full bg-white text-black text-sm font-bold tracking-wide hover:bg-zinc-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Back to Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tags = dueConcepts.map(c => c.concept_tag);
  const prompt = \`Generate a \${tags.length}-question quiz specifically testing the following concepts: \${tags.join(', ')}. Create exactly one distinct question per concept.\`;

  const ai = new GoogleGenAI({});
  const jsonSchema = zodToJsonSchema(GeneratedQuizSchema, "GeneratedQuizSchema").definitions?.GeneratedQuizSchema;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: {
        systemInstruction: "You are an expert educational AI generating a Spaced Repetition quiz. You MUST generate exactly the requested questions targeting the specific concepts provided. Ensure the \`concept_tag\` field in your output perfectly matches the requested strings so they map correctly to the database.",
        responseMimeType: 'application/json',
        responseSchema: jsonSchema as any,
        temperature: 0.7,
      }
    });

    const rawData = JSON.parse(response.text() || "{}");
    const validatedQuiz = GeneratedQuizSchema.parse(rawData);

    validatedQuiz.title = \`Daily Mix: \${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}\`;
    validatedQuiz.subject = "Spaced Repetition Review";
    validatedQuiz.description = "Curated algorithmically targeting your weakest memory nodes.";

    const result = await saveGeneratedQuiz(validatedQuiz);
    
    if (result.success && result.quizId) {
      redirect(\`/quiz/\${result.quizId}\`);
    }
  } catch (error) {
    console.error('Failed to generate Daily Mix:', error);
    throw new Error('Failed to compile your mix. Please try again.');
  }
}
`,
    'src/app/dashboard/daily-mix/loading.tsx': `export default function DailyMixLoading() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center space-y-12">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full border border-emerald-500/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <div className="absolute h-20 w-20 rounded-full border border-emerald-500/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]" />
          <div className="h-8 w-8 rounded-full bg-emerald-500/80 shadow-[0_0_40px_rgba(16,185,129,0.5)] animate-pulse" />
        </div>
        <div className="text-center space-y-3">
          <h2 className="text-zinc-100 text-xl font-bold tracking-tight">
            Compiling your weak spots...
          </h2>
          <p className="text-emerald-500/70 text-xs uppercase tracking-widest font-black animate-pulse">
            Scanning Spaced Repetition Ledger
          </p>
        </div>
      </div>
    </div>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    console.log(\`Created \${filePath}\`);
}
