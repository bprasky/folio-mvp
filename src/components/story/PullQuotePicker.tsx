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
  onUpdate: () => void;
}

export function PullQuotePicker({ pullQuote, chapterIndex, projectId, quoteClassName, onUpdate }: PullQuotePickerProps) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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

  const saveSelection = async (body: { authorship: PullQuoteAuthorship; selectedText?: string | null }, generate = false) => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const endpoint = generate ? 'folio-lines' : 'pull-quote';
      const res = await fetch(`/api/posting/project/${projectId}/sections/${endpoint}`, {
        method: generate ? 'POST' : 'PATCH',
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
  const patch = (nextText: string | null) => saveSelection({ authorship, selectedText: nextText });
  const changeAuthorship = (mode: PullQuoteAuthorship) => {
    if (mode === authorship) return;
    // POST reuses a valid saved Folio pool and refreshes stale sources if needed.
    return saveSelection({ authorship: mode }, mode === 'folio');
  };
  const handleCycle = (direction: 1 | -1) => {
    if (!hasAlternatives) return;
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex) + direction + alternatives.length) % alternatives.length;
    return patch(alternatives[nextIndex].text);
  };
  const backfill = async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quotes/backfill`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setNotice(data?.error ?? 'Could not find a quote for this section.');
      else if (data?.filled > 0) onUpdate();
      else setNotice(data?.message ?? 'Nothing quotable in the interview for this section yet.');
    } catch {
      setNotice('Could not find a quote for this section.');
    } finally {
      setSaving(false);
    }
  };
  const lineClass = quoteClassName ?? 'font-[var(--font-headline)] text-lg md:text-xl italic leading-relaxed text-folio-text-secondary';
  return (
    <div className="py-2" aria-busy={saving}>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div role="group" aria-label="Who wrote this line" className="flex items-center gap-1">
          {(['verbatim', 'folio'] as const).map(mode => (
            <button key={mode} type="button" disabled={saving} aria-pressed={authorship === mode}
              onClick={() => changeAuthorship(mode)}
              className={'folio-meta px-2 py-0.5 rounded-full border transition-colors whitespace-nowrap disabled:opacity-40 ' + (authorship === mode ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-folio-text-tertiary hover:text-folio-text-secondary')}>
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
        {selectedText && (
          <button type="button" onClick={() => patch(null)} disabled={saving} aria-label="Remove pull quote"
            className="flex items-center gap-1 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Remove
          </button>
        )}
      </div>
      {saving && <p role="status" className="mb-2 folio-meta text-folio-text-tertiary">Updating options…</p>}
      {notice && <p role="alert" className="mb-2 folio-meta text-folio-text-tertiary">{notice}</p>}
      {selectedText ? (
        authorship === 'folio' ? <p className={lineClass}>{selectedText}</p> : <blockquote className={lineClass}>&ldquo;{selectedText}&rdquo;</blockquote>
      ) : alternatives.length > 0 ? (
        <button type="button" onClick={() => patch(alternatives[0].text)} disabled={saving}
          className="folio-meta text-[var(--accent)] hover:text-folio-text-primary disabled:opacity-40">
          {authorship === 'folio' ? 'Restore Folio version' : 'Add pull quote'}
        </button>
      ) : (
        <button type="button" onClick={backfill} disabled={saving}
          className="folio-meta text-[var(--accent)] hover:text-folio-text-primary disabled:opacity-40">
          Add a pull quote from the interview
        </button>
      )}
      {selectedText && selectedContext && <p className="mt-2 folio-meta tracking-wide uppercase text-folio-text-tertiary">— {selectedContext}</p>}
    </div>
  );
}

export default PullQuotePicker;
