export default function AiBlindSpotSkeleton() {
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
