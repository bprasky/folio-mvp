'use client';

type Props = { onClose: () => void };

export function AIUpsellModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-base)] border border-[var(--ridge-outer)] shadow-2xl p-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Unlock Folio AI</h3>
          <button
            onClick={onClose}
            className="folio-meta text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            Close
          </button>
        </div>
        <p className="text-[var(--text-secondary)]">
          Right now you can see what happened. Folio AI shows you <strong className="text-[var(--text-primary)]">what it means</strong>,{' '}
          <strong className="text-[var(--text-primary)]">how you compare</strong>, and <strong className="text-[var(--text-primary)]">what to do about it</strong> - with one
          click.
        </p>
        <ul className="list-disc list-inside folio-meta text-[var(--text-secondary)] space-y-1 pl-2">
          <li>Plain-language explanations of every key metric.</li>
          <li>Benchmarks vs similar vendors and past performance.</li>
          <li>2–3 prioritized recommendations for each section.</li>
          <li>One-click actions inside Folio: events, editorials, designer outreach.</li>
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] folio-meta transition"
          >
            Maybe later
          </button>
          <button
            className="rounded-xl px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 folio-meta transition"
            onClick={() => {
              // TODO: Wire to sales/upgrade flow
              console.log('[AI UPSELL] Talk to sales clicked');
              onClose();
            }}
          >
            Talk to sales
          </button>
        </div>
      </div>
    </div>
  );
}


