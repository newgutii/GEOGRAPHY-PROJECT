import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export default async function AiBlindSpot({ missedTags }: { missedTags: string[] }) {
  let insight = "Keep practicing to identify and eliminate your blind spots.";
  
  if (missedTags.length > 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `The user just took a quiz and missed questions related to these concepts: ${missedTags.join(', ')}. Write a brief 2-3 sentence insight identifying their blind spot and encouraging them. Keep it direct, professional, and slightly analytical. Return plain text only.`,
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
