'use client';
export default function ActionPill({label,onClick}:{label:string;onClick:()=>void}) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 text-sm rounded-lg bg-canvas/10 hover:bg-canvas/20 border border-white/10">
      {label}
    </button>
  );
}





