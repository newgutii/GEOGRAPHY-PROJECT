export default function DailyMixLoading() {
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
