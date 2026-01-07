'use client';

export function PlaceholderChart({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[180px] bg-stone/10 rounded-lg border border-stone/20">
      <div className="text-center">
        <div className="text-2xl mb-2">📊</div>
        <div className="font-serif text-lg mb-1">{title}</div>
        <div className="text-sm text-stone-400">{description}</div>
      </div>
    </div>
  );
}








