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
    <div className="ridge-card p-6 text-center">
      <div className="folio-ui text-[var(--text-primary)]">{title}</div>
      {subtitle && <div className="folio-meta text-[var(--text-secondary)] mt-1">{subtitle}</div>}
    </div>
  );
}

