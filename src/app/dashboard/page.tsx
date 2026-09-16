import CustomQuizGenerator from '@/components/dashboard/CustomQuizGenerator';
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
                className={`p-6 rounded-2xl border hover:-translate-y-1 transition-all duration-300 ${card.color}`}
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
