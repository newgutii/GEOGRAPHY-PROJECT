'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { submitQuizAttempt, SubmitAttemptPayload } from '@/actions/attempts';
import { Timer, Sparkles, AlertCircle } from 'lucide-react';

type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  concept_tag: string;
};

interface QuizMeta {
  title?: string;
  subject?: string;
  difficulty?: string;
  timeLimitPerQuestion?: number;
}

export default function QuizEngine({ 
  quizId, 
  questions, 
  ghostReferenceId,
  quizMeta,
}: { 
  quizId: string;
  questions: Question[];
  ghostReferenceId?: string;
  quizMeta?: QuizMeta;
}) {
  const router = useRouter();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<SubmitAttemptPayload['answers']>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  
  const [startTime] = useState<string>(() => new Date().toISOString());
  
  const questionStartTimeRef = useRef<number>(0);
  
  const timeLimit = quizMeta?.timeLimitPerQuestion ?? 20;
  const isTimed = timeLimit > 0;
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit);
  const [timedOutFeedback, setTimedOutFeedback] = useState(false);
  const [selectedForFeedback, setSelectedForFeedback] = useState<string | null>(null);
  
  const currentQuestion = questions[currentIndex];
  
  // Track elapsed time for untimed mode
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const handleOptionSelect = useCallback(async (selectedOption: string) => {
    if (isSubmitting || selectedForFeedback) return;
    
    setSelectedForFeedback(selectedOption);

    const now = Date.now();
    const timeTakenMs = questionStartTimeRef.current > 0 ? now - questionStartTimeRef.current : 0;
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
    
    // Brief pause to display visual confirmation
    setTimeout(async () => {
      setSelectedForFeedback(null);
      setTimedOutFeedback(false);
      setAnswers(newAnswers);
      
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setHint(null);
        setTimeLeft(timeLimit);
        questionStartTimeRef.current = Date.now();
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
    }, 400);
  }, [isSubmitting, selectedForFeedback, currentQuestion, answers, currentIndex, questions.length, timeLimit, quizId, startTime, ghostReferenceId, router]);

  // Timer effect
  useEffect(() => {
    questionStartTimeRef.current = Date.now();

    if (!isTimed) {
      const elapsedInterval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
      return () => clearInterval(elapsedInterval);
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimedOutFeedback(true);
          handleOptionSelect('[Time Expired]');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isTimed, handleOptionSelect]);

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

  const getDifficultyColor = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case 'beginner':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'advanced':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'master':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'intermediate':
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const timerPercentage = isTimed ? Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100)) : 100;
  const isTimeCritical = isTimed && timeLeft <= 5;
  const isTimeUrgent = isTimed && timeLeft <= 3;
  
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
    <div className="max-w-2xl mx-auto w-full space-y-8">
      {/* Top Header with Progress, Timer & Badges */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 text-xs font-bold tracking-widest uppercase">
              Question {currentIndex + 1} <span className="text-zinc-600">/ {questions.length}</span>
            </span>
            {quizMeta?.difficulty && (
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md border ${getDifficultyColor(quizMeta.difficulty)}`}>
                {quizMeta.difficulty}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Display */}
            {isTimed ? (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold transition-colors ${
                isTimeUrgent 
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' 
                  : isTimeCritical 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}>
                <Timer className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-800/80 bg-zinc-900/60 text-xs font-mono text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Zen ({Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')})</span>
              </div>
            )}

            {/* AI Lifeline Button */}
            <button 
              onClick={handleLifeline}
              disabled={isLoadingHint || !!hint}
              className="text-[10px] font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full bg-zinc-900 text-purple-400 hover:bg-zinc-800 disabled:opacity-50 transition-colors ring-1 ring-white/5 flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>{isLoadingHint ? 'Hint...' : hint ? 'Hint Ready' : 'Lifeline'}</span>
            </button>
          </div>
        </div>

        {/* Timed countdown bar */}
        {isTimed && (
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                isTimeUrgent ? 'bg-rose-500' : isTimeCritical ? 'bg-amber-500' : 'bg-purple-500'
              }`}
              style={{ width: `${timerPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Timeout Alert Banner */}
      {timedOutFeedback && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Time expired on this question! Advancing...</span>
        </div>
      )}

      {/* Question Text */}
      <h2 className="text-2xl md:text-3xl font-medium leading-snug text-zinc-100 tracking-tight">
        {currentQuestion.question_text}
      </h2>

      {/* Hint Box */}
      {hint && (
        <div className="bg-purple-900/20 border border-purple-500/20 p-4 md:p-5 rounded-2xl text-purple-200 text-sm leading-relaxed shadow-inner">
          <span className="font-bold uppercase tracking-widest text-[10px] text-purple-400 block mb-1">
            Tutor Insight
          </span> 
          {hint}
        </div>
      )}

      {/* Options List */}
      <div className="grid grid-cols-1 gap-3 pt-2">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedForFeedback === option;
          return (
            <button
              key={idx}
              onClick={() => handleOptionSelect(option)}
              disabled={!!selectedForFeedback || timedOutFeedback}
              className={`text-left w-full p-5 rounded-xl border transition-all font-medium text-lg flex items-center justify-between ${
                isSelected
                  ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/40 scale-[0.99]'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white active:scale-[0.98]'
              }`}
            >
              <span>{option}</span>
              {isSelected && (
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* Concept Tag indicator */}
      <div className="pt-4 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
        <span>Concept Node: <span className="text-zinc-400">{currentQuestion.concept_tag}</span></span>
        {quizMeta?.title && (
          <span className="truncate max-w-[200px] text-zinc-500">{quizMeta.title}</span>
        )}
      </div>
    </div>
  );
}

