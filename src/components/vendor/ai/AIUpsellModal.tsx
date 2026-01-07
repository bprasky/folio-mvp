'use client';

type Props = { onClose: () => void };

export function AIUpsellModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-300 shadow-2xl p-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-neutral-800">Unlock Folio AI</h3>
          <button 
            onClick={onClose} 
            className="text-xs text-neutral-600 hover:text-neutral-800 transition"
          >
            Close
          </button>
        </div>
        <p className="text-neutral-600">
          Right now you can see what happened. Folio AI shows you <strong className="text-neutral-900">what it means</strong>,{' '}
          <strong className="text-neutral-900">how you compare</strong>, and <strong className="text-neutral-900">what to do about it</strong> — with one
          click.
        </p>
        <ul className="list-disc list-inside text-xs text-neutral-600 space-y-1 pl-2">
          <li>Plain-language explanations of every key metric.</li>
          <li>Benchmarks vs similar vendors and past performance.</li>
          <li>2–3 prioritized recommendations for each section.</li>
          <li>One-click actions inside Folio: events, editorials, designer outreach.</li>
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button 
            onClick={onClose} 
            className="rounded-xl px-4 py-2 border border-neutral-300 hover:bg-neutral-100 text-neutral-700 text-xs transition"
          >
            Maybe later
          </button>
          <button 
            className="rounded-xl px-4 py-2 bg-black text-white hover:bg-neutral-800 text-xs transition"
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


