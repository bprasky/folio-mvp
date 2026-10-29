export function SetupProgress({ step }: { step: 1 | 2 | 3 }) {
  return <ol aria-label="Professional signup progress" className="setup-progress flex gap-3 text-xs leading-5 mb-6">
    {['Personal account', 'Your business', 'Your workspace'].map((label, index) => <li key={label}
      aria-current={index + 1 === step ? 'step' : undefined}
      className={`flex-1 border-t-2 pt-2 ${index + 1 <= step ? 'border-current text-folio-text-primary' : 'border-folio-border-subtle text-folio-text-secondary'}`}>
      <span className="block">{index + 1 < step ? '✓ Complete' : `Step ${index + 1}`}</span><span>{label}</span>
    </li>)}
  </ol>;
}
