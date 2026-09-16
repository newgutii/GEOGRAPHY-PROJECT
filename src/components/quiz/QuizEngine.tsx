'use client';

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
          router.push(`/dashboard/debrief/${result.attemptId}`);
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
