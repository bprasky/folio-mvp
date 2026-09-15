'use client';

// Direct quotes remain untouched; Folio versions have their own stored pool.
import { useState } from 'react';
import type { PullQuoteSelection, PullQuoteAuthorship } from '@/lib/posting/schemas';
import { isPullQuoteSelection } from '@/lib/posting/schemas';

interface PullQuotePickerProps {
  pullQuote: string | PullQuoteSelection | null | undefined;
  chapterIndex: number;
  projectId: string;
  quoteClassName?: string;
  preparing?: boolean;
  onUpdate: () => void;
}

export function PullQuotePicker({ pullQuote, chapterIndex, projectId, quoteClassName, preparing = false, onUpdate }: PullQuotePickerProps) {
  const [requestSaving, setSaving] = useState(false);
  const saving = requestSaving || preparing;
  const [notice, setNotice] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const isSelection = isPullQuoteSelection(pullQuote);
  const authorship: PullQuoteAuthorship = (isSelection ? pullQuote.authorship : undefined) ?? 'verbatim';
  const selectedText = authorship === 'folio' && isSelection
    ? pullQuote.folio?.selected?.text ?? null
    : typeof pullQuote === 'string' ? pullQuote : pullQuote?.selected?.text ?? null;
  const selectedContext = authorship === 'verbatim' && isSelection ? pullQuote.selected?.context : undefined;
  const alternatives = isSelection
    ? authorship === 'folio' ? pullQuote.folio?.alternatives ?? [] : pullQuote.alternatives
    : [];
  const currentIndex = selectedText ? alternatives.findIndex(a => a.text === selectedText) : -1;
  const hasAlternatives = alternatives.length > 1;

  const saveSelection = async (body: { authorship: PullQuoteAuthorship; selectedText?: string }) => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice(data?.error ?? 'Could not update this selection. Please try again.');
      else onUpdate();
    } catch {
      setNotice('Could not update this selection. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const patch = (nextText: string) => saveSelection({ authorship, selectedText: nextText });
  const changeAuthorship = (mode: PullQuoteAuthorship) => {
    if (mode === authorship) return;
    return saveSelection({ authorship: mode });
  };
  const handleCycle = (direction: 1 | -1) => {
    if (!hasAlternatives) return;
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex) + direction + alternatives.length) % alternatives.length;
    return patch(alternatives[nextIndex].text);
  };
  const lineClass = quoteClassName ?? 'font-[var(--font-headline)] text-lg md:text-xl italic leading-relaxed text-folio-text-secondary';
  return (
    <div className="rounded-xl border border-folio-border bg-[var(--surface-ground)] p-5" aria-busy={saving}>
      <h3 className="folio-body font-semibold text-folio-text-primary">Choose your room’s opening line</h3>
      <p className="folio-meta text-folio-text-secondary mt-1 mb-4">We’ve selected a teaser for your room and social posts. Choose your favorite — readers click this line to open the room’s story.</p>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div role="group" aria-label="Who wrote this line" className="flex items-center gap-1">
          {(['verbatim', 'folio'] as const).filter(mode => mode === 'verbatim' ? (isSelection ? pullQuote.alternatives.length > 0 : !!selectedText) : !!(isSelection && pullQuote.folio?.alternatives.length)).map(mode => (
            <button key={mode} type="button" disabled={saving} aria-pressed={authorship === mode}
              onClick={() => changeAuthorship(mode)}
              className={'folio-meta px-3 py-2 rounded-full border transition-colors whitespace-nowrap disabled:opacity-40 ' + (authorship === mode ? 'border-folio-text-primary bg-[var(--folio-text-primary)] text-[var(--surface-canvas)]' : 'border-folio-border text-folio-text-primary hover:bg-[var(--surface-canvas)]')}>
              {mode === 'verbatim' ? 'Your words' : 'Written by Folio'}
            </button>
          ))}
        </div>
        {selectedText && hasAlternatives && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving} onClick={() => handleCycle(-1)} aria-label="Previous pull quote"
              className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 p-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="folio-meta text-folio-text-tertiary tabular-nums">{currentIndex >= 0 ? currentIndex + 1 : 1} of {alternatives.length}</span>
            <button type="button" disabled={saving} onClick={() => handleCycle(1)} aria-label="Next pull quote"
              className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 p-0.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <p className="folio-meta text-folio-text-secondary mb-3">{authorship === 'folio' ? 'Original editorial lines inspired by your room’s story.' : 'Direct quotes from your interview. Browse to find your favorite.'}</p>
      {saving && <p role="status" className="mb-2 folio-meta text-folio-text-tertiary">Updating options…</p>}
      {notice && <p role="alert" className="mb-2 folio-meta text-folio-text-tertiary">{notice}</p>}
      {selectedText ? (
        authorship === 'folio' ? <p className={lineClass}>{selectedText}</p> : <blockquote className={lineClass}>&ldquo;{selectedText}&rdquo;</blockquote>
      ) : (
        <p role="status" className="folio-meta text-folio-text-secondary">Preparing your room’s opening lines…</p>
      )}
      {selectedText && selectedContext && <p className="mt-2 folio-meta tracking-wide uppercase text-folio-text-tertiary">— {selectedContext}</p>}
      {hasAlternatives && (
        <div className="mt-4">
          <button type="button" aria-expanded={showOptions} onClick={() => setShowOptions(!showOptions)}
            className="folio-meta font-semibold text-folio-text-primary underline underline-offset-4 py-2">
            {showOptions ? 'Hide options' : `Browse all ${alternatives.length} options`}
          </button>
          {showOptions && <div role="group" aria-label="Room opening line options" className="mt-2 flex flex-col gap-2">
            {alternatives.map(option => <button key={option.text} type="button" disabled={saving}
              aria-pressed={selectedText === option.text} onClick={() => patch(option.text)}
              className={'text-left folio-body rounded-lg border p-3 text-folio-text-primary disabled:opacity-40 ' + (selectedText === option.text ? 'border-folio-text-primary bg-[var(--surface-canvas)]' : 'border-folio-border')}>
              {option.text}
            </button>)}
          </div>}
        </div>
      )}
    </div>
  );
}

export default PullQuotePicker;
