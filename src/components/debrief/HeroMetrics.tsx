export default function HeroMetrics({ 
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
          <p className={`text-6xl md:text-7xl font-black tracking-tighter ${ghostDelta >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
            {ghostDelta > 0 ? '+' : ''}{ghostDelta.toFixed(2)}
          </p>
        ) : (
          <p className="text-6xl md:text-7xl font-black tracking-tighter text-zinc-700">--</p>
        )}
      </div>
    </section>
  );
}
