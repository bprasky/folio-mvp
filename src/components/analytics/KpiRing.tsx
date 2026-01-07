export function KpiRing({ value=72, label='Engagement', tone='perf' }:{
  value:number; label:string; tone?:'engage'|'perf'|'opp'|'risk'
}) {
  const dash = 283, stroke = Math.round((value/100)*dash);
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none"/>
        <circle cx="50" cy="50" r="45" stroke={`var(--tw-color-accent-${tone})`} strokeWidth="8"
                strokeDasharray={`${stroke} ${dash-stroke}`} strokeLinecap="round" fill="none"
                transform="rotate(-90 50 50)"/>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-serif text-xl">{value}%</div>
          <div className="text-xs opacity-70">{label}</div>
        </div>
      </div>
    </div>
  );
}








