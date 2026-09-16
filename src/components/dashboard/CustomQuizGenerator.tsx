'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveGeneratedQuiz } from '@/actions/quizzes';
import { GeneratedQuiz } from '@/lib/gemini/schemas';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  SlidersHorizontal, 
  Flame, 
  ShieldCheck, 
  Compass, 
  Crown,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookOpen,
  Lightbulb,
  Brain
} from 'lucide-react';

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';
type QuizStyle = 'standard' | 'trivia' | 'conceptual';

export default function CustomQuizGenerator() {
  const router = useRouter();

  // Multi-step state: 'theme' -> 'configure' -> 'generating'
  const [step, setStep] = useState<'theme' | 'configure' | 'generating'>('theme');
  
  // Quiz parameters
  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate');
  const [timeLimit, setTimeLimit] = useState<number>(20); // seconds: 10, 20, 35, 0 (untimed)
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [style, setStyle] = useState<QuizStyle>('standard');
  const [customFocus, setCustomFocus] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generation status
  const [messageIndex, setMessageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick suggestion chips
  const suggestions = [
    { label: '🌍 World Capitals', prompt: 'World Capitals and Geography' },
    { label: '🏛️ Ancient Civilizations', prompt: 'Ancient Rome, Egypt, and Greece' },
    { label: '⚛️ Quantum Physics', prompt: 'Quantum Physics Fundamentals' },
    { label: '💻 React & Modern Web', prompt: 'React Hooks, SSR, and Modern Web' },
    { label: '🧬 Human Anatomy', prompt: 'Human Anatomy and Organ Systems' },
    { label: '🎬 Classic Cinema', prompt: 'Classic Cinema and Film Directors' },
  ];

  const messages = [
    `Extracting concept ontology for "${prompt}"...`,
    `Calibrating ${difficulty} level questions & plausible distractors...`,
    `Synthesizing ${questionCount} questions in ${style} format...`,
    `Configuring Spaced Repetition (SRS) memory tags...`,
    `Finalizing timed challenge run...`
  ];

  // Cycling generation status messages
  useEffect(() => {
    if (step !== 'generating') return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [step, messages.length]);

  const handleThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setErrorMessage(null);
    setStep('configure');
  };

  const handleStartGeneration = async () => {
    setStep('generating');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
          difficulty,
          timeLimit,
          questionCount,
          style,
          customFocus: customFocus.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }

      const generatedQuiz: GeneratedQuiz = await response.json();

      const result = await saveGeneratedQuiz(generatedQuiz, {
        difficulty,
        timeLimit
      });

      if (result.success && result.quizId) {
        router.push(`/quiz/${result.quizId}`);
      } else {
        throw new Error('Failed to save quiz to database');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setErrorMessage('Generation encountered an issue. Please check parameters and try again.');
      setStep('configure');
    }
  };

  // STEP 1: Theme Entry View
  if (step === 'theme') {
    return (
      <div className="w-full max-w-3xl space-y-6">
        <form onSubmit={handleThemeSubmit} className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-600 rounded-2xl blur-xl opacity-20 transition-all duration-700 group-hover:opacity-40" />
          <div className="relative bg-[#0A0A0C] border border-zinc-800/90 rounded-2xl p-6 md:p-10 shadow-2xl focus-within:border-purple-500/50 transition-colors">
            <div className="flex items-center justify-between pb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Sparkles className="w-3.5 h-3.5" />
                Step 1 of 2: Topic & Theme
              </span>
              <span className="hidden sm:inline text-zinc-600">Press Enter or Continue</span>
            </div>

            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What are we studying today?"
              autoFocus
              className="w-full bg-transparent text-zinc-100 placeholder-zinc-700 text-2xl md:text-4xl font-extrabold tracking-tight focus:outline-none pt-2 pb-6 border-b border-zinc-800/80"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6">
              <p className="text-xs text-zinc-500">
                Type any subject, exam topic, or niche obsession.
              </p>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/30 active:scale-95"
              >
                <span>Customize Quiz</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Quick Inspiration Pills */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            Quick Launch Inspiration:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(item.prompt);
                  setStep('configure');
                }}
                className="text-xs px-3.5 py-1.5 rounded-full bg-zinc-900/70 border border-zinc-800/80 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800 transition-all font-medium"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Configuration View (Difficulty, Time, and More)
  if (step === 'configure') {
    return (
      <div className="w-full max-w-3xl relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-fuchsia-500/20 to-emerald-600/30 rounded-3xl blur-2xl opacity-40 pointer-events-none" />

        <div className="relative bg-[#0D0D11] border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8">
          {/* Header & Theme summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Step 2 of 2: Quiz Calibration
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                Configure Parameters
              </h2>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-xl text-xs">
              <span className="text-zinc-500">Theme:</span>
              <span className="font-semibold text-zinc-200 truncate max-w-[180px] sm:max-w-[220px]">
                {prompt}
              </span>
              <button
                type="button"
                onClick={() => setStep('theme')}
                className="text-purple-400 hover:text-purple-300 font-bold ml-1 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Change
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Difficulty */}
          <div className="space-y-3">
            <label className="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center justify-between">
              <span>Select Difficulty</span>
              <span className="text-zinc-600 normal-case text-[11px]">Affects question depth and distractor plausibility</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { 
                  id: 'Beginner', 
                  label: 'Beginner', 
                  desc: 'Core fundamentals',
                  icon: Compass,
                  color: 'hover:border-emerald-500/50',
                  activeColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                },
                { 
                  id: 'Intermediate', 
                  label: 'Intermediate', 
                  desc: 'Solid balanced run',
                  icon: ShieldCheck,
                  color: 'hover:border-amber-500/50',
                  activeColor: 'border-amber-500 bg-amber-500/10 text-amber-300'
                },
                { 
                  id: 'Advanced', 
                  label: 'Advanced', 
                  desc: 'Nuanced & tricky',
                  icon: Flame,
                  color: 'hover:border-rose-500/50',
                  activeColor: 'border-rose-500 bg-rose-500/10 text-rose-300'
                },
                { 
                  id: 'Master', 
                  label: 'Master', 
                  desc: 'Elite obscure trivia',
                  icon: Crown,
                  color: 'hover:border-purple-500/50',
                  activeColor: 'border-purple-500 bg-purple-500/10 text-purple-300'
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = difficulty === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDifficulty(item.id as Difficulty)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-28 ${
                      isSelected 
                        ? `${item.activeColor} ring-1 ring-white/10 shadow-lg` 
                        : `bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 ${item.color}`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className="w-5 h-5" />
                      {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className="text-[10px] opacity-70 leading-tight mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Time Limit per Question */}
          <div className="space-y-3">
            <label className="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center justify-between">
              <span>Time Limit Per Question</span>
              <span className="text-zinc-600 normal-case text-[11px]">Adrenaline pacing & speed scoring</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { 
                  value: 10, 
                  label: '⚡ Blitz (10s)', 
                  desc: 'Fast reflex challenge',
                  activeColor: 'border-rose-500 bg-rose-500/10 text-rose-300'
                },
                { 
                  value: 20, 
                  label: '⏱️ Standard (20s)', 
                  desc: 'Classic test pace',
                  activeColor: 'border-purple-500 bg-purple-500/10 text-purple-300'
                },
                { 
                  value: 35, 
                  label: '⏳ Thinker (35s)', 
                  desc: 'Deep analytical time',
                  activeColor: 'border-blue-500 bg-blue-500/10 text-blue-300'
                },
                { 
                  value: 0, 
                  label: '🧘 Untimed (Zen)', 
                  desc: 'Study at your leisure',
                  activeColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                },
              ].map((item) => {
                const isSelected = timeLimit === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTimeLimit(item.value)}
                    className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                      isSelected 
                        ? `${item.activeColor} ring-1 ring-white/10 shadow-lg` 
                        : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-sm flex items-center justify-between">
                      <span>{item.label}</span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </div>
                    <div className="text-[10px] opacity-70 leading-tight">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: "And More" - Advanced Customization Options */}
          <div className="border-t border-zinc-800/80 pt-5 space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                And More: Question Count, Style & Focus Notes
              </span>
              <span className="flex items-center gap-1 text-[11px] text-purple-400 font-semibold lowercase">
                {showAdvanced ? 'hide details' : 'expand settings'}
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {showAdvanced && (
              <div className="space-y-6 pt-2 pb-2 pl-1 animate-fadeIn">
                {/* Question Count */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 block">
                    Number of Questions
                  </label>
                  <div className="flex gap-3">
                    {[
                      { count: 5, label: '5 Questions', sub: '~2 min sprint' },
                      { count: 10, label: '10 Questions', sub: '~5 min run' },
                      { count: 15, label: '15 Questions', sub: '~8 min deep dive' },
                    ].map((item) => (
                      <button
                        key={item.count}
                        type="button"
                        onClick={() => setQuestionCount(item.count)}
                        className={`flex-1 py-3 px-4 rounded-xl border text-center transition-all ${
                          questionCount === item.count
                            ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] text-zinc-500">{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quiz Format / Style */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 block">
                    Quiz Style & Tone
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { 
                        id: 'standard', 
                        label: '🎯 Academic Standard', 
                        desc: 'Classic test of facts & definitions',
                        icon: BookOpen 
                      },
                      { 
                        id: 'trivia', 
                        label: '💡 Fascinating Trivia', 
                        desc: 'Surprising lore & curious details',
                        icon: Lightbulb 
                      },
                      { 
                        id: 'conceptual', 
                        label: '🧠 Problem Solving', 
                        desc: 'Scenario-based analytical deduction',
                        icon: Brain 
                      },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setStyle(item.id as QuizStyle)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          style === item.id
                            ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{item.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Focus Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 block">
                    Special Focus or Specific Constraints (Optional)
                  </label>
                  <input
                    type="text"
                    value={customFocus}
                    onChange={(e) => setCustomFocus(e.target.value)}
                    placeholder="e.g. Focus on dates, include map landmarks, or emphasize modern implementations..."
                    className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setStep('theme')}
              className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center gap-2 border border-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <button
              type="button"
              onClick={handleStartGeneration}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold text-sm flex items-center gap-2.5 transition-all shadow-xl shadow-purple-900/40 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Synthesize & Launch Quiz</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Generating State View
  return (
    <div className="w-full max-w-xl text-center space-y-8 py-12 px-6 bg-[#0D0D11] border border-zinc-800 rounded-3xl relative overflow-hidden">
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-600 rounded-3xl blur-2xl opacity-30 animate-pulse" />

      <div className="relative space-y-6">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/30 animate-ping" />
          <div className="w-16 h-16 rounded-full border-3 border-purple-500 border-t-transparent animate-spin flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-zinc-100 tracking-tight">
            Synthesizing &ldquo;{prompt}&rdquo;
          </h3>
          <p className="text-xs font-mono text-purple-300/80 animate-pulse">
            {messages[messageIndex]}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
          <span>{difficulty}</span>
          <span>•</span>
          <span>{timeLimit > 0 ? `${timeLimit}s Time Limit` : 'Untimed Zen'}</span>
          <span>•</span>
          <span>{questionCount} Questions</span>
        </div>

        <button
          type="button"
          onClick={() => setStep('configure')}
          className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

