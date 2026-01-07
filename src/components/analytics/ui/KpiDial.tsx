'use client';
export default function KpiDial({
  value, label, delta, tone='perf'
}:{ value:number|string; label:string; delta?:number; tone?:'engage'|'perf'|'opp'|'risk'}) {
  const v = typeof value==='number' ? `${value}` : value;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none"/>
          <circle cx="50" cy="50" r="44" stroke={`oklch(var(--accent-${tone}))`} strokeWidth="8"
                  strokeDasharray="190 400" strokeLinecap="round" fill="none" transform="rotate(-90 50 50)"/>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-serif text-xl">{v}</div>
            <div className="text-xs opacity-70">{label}</div>
          </div>
        </div>
      </div>
      {typeof delta==='number' &&
        <div className={`text-sm ${delta>=0?'text-accent-opp':'text-accent-risk'}`}>
          {delta>=0 ? '↑' : '↓'} {Math.abs(delta)}%
        </div>}
    </div>
  );
}





