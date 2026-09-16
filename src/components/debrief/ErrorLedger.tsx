export default function ErrorLedger({ answers }: { answers: any[] }) {
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
