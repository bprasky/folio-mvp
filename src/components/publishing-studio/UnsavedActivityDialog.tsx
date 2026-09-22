'use client';

import { useEffect, useRef, useState } from 'react';

/** Shared by explicit-save activities: clean browsing never prompts or writes. */
export function useActivityExit(dirty: boolean, pending: boolean, save: () => Promise<boolean>) {
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const bypass = useRef(false);
  const requestExit = (action: () => void) => {
    if (pending) return;
    if (dirty) setLeave(() => action); else action();
  };
  useEffect(() => {
    const href = window.location.href;
    const historyState = window.history.state;
    function unload(event: BeforeUnloadEvent) { if (!bypass.current && (dirty || pending)) { event.preventDefault(); event.returnValue = ''; } }
    function click(event: MouseEvent) {
      const anchor = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.href === href || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || bypass.current || (!dirty && !pending)) return;
      event.preventDefault(); event.stopPropagation();
      if (!pending) setLeave(() => () => window.location.assign(anchor.href));
    }
    function pop(event: PopStateEvent) {
      if (bypass.current || (!dirty && !pending)) return;
      event.stopImmediatePropagation(); window.history.pushState(historyState, '', href);
      if (!pending) setLeave(() => () => window.history.back());
    }
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', pop, true); };
  }, [dirty, pending]);
  function finish() { bypass.current = true; leave?.(); setLeave(null); }
  return { requestExit, dialog: leave ? <UnsavedActivityDialog pending={pending} onKeep={() => setLeave(null)} onDiscard={finish} onSave={async () => { const saved = await save(); if (saved) finish(); return saved; }} /> : null };
}

function UnsavedActivityDialog({ pending, onKeep, onDiscard, onSave }: { pending: boolean; onKeep(): void; onDiscard(): void; onSave(): Promise<boolean> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { ref.current?.showModal?.(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); if (!pending) onKeep(); }} className="max-w-md rounded-2xl border border-folio-border-subtle p-6 backdrop:bg-black/40">
    <h2 className="folio-h3">Save your changes?</h2><p className="folio-body my-4">Save a draft to finish later, or leave without these changes.</p>
    {error && <p role="alert" className="folio-body my-3">{error}</p>}
    <div className="flex flex-wrap gap-4"><button disabled={pending} className="folio-ui underline" onClick={async () => { setError(''); if (!await onSave()) setError('Could not save your changes. Try again or keep editing.'); }}>Save draft and exit</button><button disabled={pending} className="folio-ui underline" onClick={onDiscard}>Exit without saving</button><button disabled={pending} className="folio-ui underline" onClick={onKeep}>Keep editing</button></div>
  </dialog>;
}
