'use client';

type SummaryItem = {
  label: string;
  value?: number | string;   // tolerate undefined
  delta?: number;            // +/- %
  tone?: 'engage'|'perf'|'opp'|'risk';
};

export default function SummaryStrip({ items=[] as SummaryItem[] }) {
  const safe = items.length ? items : [
    { label:'Pipeline', value:'—', delta:0, tone:'opp' },
    { label:'Designers', value:'—', delta:0, tone:'engage' },
    { label:'Saves/Designer', value:'—', delta:0, tone:'perf' },
    { label:'Save→Tag', value:'—', delta:0, tone:'perf' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
      {safe.map((it, i)=>(
        <div key={i} className="rounded-xl card-border bg-ink/40 px-4 py-3">
          <div className="text-xs opacity-80">{it.label}</div>
          <div className="flex items-baseline gap-2">
            <div className="text-lg md:text-xl font-serif">{String(it.value ?? '—')}</div>
            {typeof it.delta==='number' && (
              <span className={`text-xs ${it.delta>=0?'text-accent-opp':'text-accent-risk'}`}>
                {it.delta>=0 ? '↑' : '↓'} {Math.abs(it.delta)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}








