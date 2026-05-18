import { cn } from '@/lib/utils';

interface RoleCardProps {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

// Role selection card for the diagnostic step (17_ONBOARDING_FLOW Step 1).
// One-line functional definition — not a marketing surface.
export function RoleCard({ label, description, selected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full text-left rounded-2xl px-6 py-5',
        'bg-surface-ground/60 backdrop-blur-sm',
        'border transition-all',
        selected
          ? 'border-[var(--accent)] shadow-[0_0_0_2px_var(--accent)]'
          : 'border-folio-border-subtle/70 hover:border-folio-border-subtle hover:bg-surface-ground/80',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'
      )}
    >
      <div className="font-headline text-2xl text-folio-text-primary leading-tight">
        {label}
      </div>
      <div className="font-body text-sm text-folio-text-secondary mt-2">
        {description}
      </div>
    </button>
  );
}
