/**
 * Empty state component for vendor dashboard
 * Provides first-class empty states instead of raw blanks
 * High contrast text for readability
 */
export function EmptyState({ 
  title, 
  subtitle 
}: { 
  title: string; 
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl p-6 border border-neutral-300/50 bg-white/40 backdrop-blur-xl text-center shadow-sm">
      <div className="text-sm text-neutral-700">{title}</div>
      {subtitle && <div className="text-xs text-neutral-600 mt-1">{subtitle}</div>}
    </div>
  );
}

