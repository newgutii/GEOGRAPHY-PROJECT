'use client';

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
        router.push(`/quiz/${result.quizId}`);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative group">
      <div 
        className={`absolute -inset-1 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-600 rounded-2xl blur-xl opacity-20 transition-all duration-1000 
        ${isGenerating ? 'opacity-80 animate-pulse duration-500 scale-105' : 'group-hover:opacity-40 group-hover:duration-200'}`} 
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
