'use client';

import { useEffect, useRef, useState } from 'react';

export type StudioTab = 'suggestions' | 'progress' | 'exports';
export const studioAction = 'inline-flex items-center justify-center rounded-full border border-folio-border-strong px-5 py-2.5 folio-ui text-folio-text-primary transition-colors hover:bg-surface-ground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-folio-text-primary disabled:opacity-50';

export function StudioIntro() {
  return <header className="space-y-2">
    <p className="folio-meta uppercase tracking-widest text-folio-text-secondary">Publishing Studio</p>
    <h1 className="folio-h2 sm:folio-h1">Your work has more to say.</h1>
  </header>;
}

export function StudioTabs({ value, onChange }: { value: StudioTab; onChange: (tab: StudioTab) => void }) {
  const tabs: { id: StudioTab; label: string }[] = [{ id: 'suggestions', label: 'Suggestions' }, { id: 'progress', label: 'In progress' }, { id: 'exports', label: 'Exports' }];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="tablist" aria-label="Publishing workspace" className="flex gap-6 border-b border-folio-border-subtle sm:gap-8">
    {tabs.map((tab, index) => <button key={tab.id} id={`studio-tab-${tab.id}`} ref={node => { refs.current[index] = node; }}
      role="tab" type="button" aria-selected={value === tab.id} aria-controls="studio-panel" tabIndex={value === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
        if (next < 0) return; event.preventDefault(); onChange(tabs[next].id); refs.current[next]?.focus();
      }} className={`border-b-2 py-4 folio-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-folio-text-primary ${value === tab.id ? 'border-folio-text-primary text-folio-text-primary' : 'border-transparent text-folio-text-secondary hover:text-folio-text-primary'}`}>{tab.label}</button>)}
  </div>;
}

/** Only the supplied candidate assets are eligible; failed imagery is never a finished cover. */
export function StudioPhoto({ images, alt, className = '', onUnavailable }: { images: { id: string; url: string }[]; alt: string; className?: string; onUnavailable?: (unavailable: boolean) => void }) {
  const [failed, setFailed] = useState<string[]>([]);
  const image = images.find(item => item.url && !failed.includes(item.url));
  useEffect(() => { onUnavailable?.(!image); }, [image, onUnavailable]);
  return <div className={`overflow-hidden bg-surface-elevated ${className}`}>
    {image ? <img key={image.url} src={image.url} alt={alt} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(current => [...current, image.url])} /> /* eslint-disable-line @next/next/no-img-element */
      : <div className="flex h-full min-h-32 items-center justify-center p-6 text-center"><p className="folio-meta text-folio-text-secondary">Source image unavailable. Review the story’s imagery before sharing.</p></div>}
  </div>;
}
