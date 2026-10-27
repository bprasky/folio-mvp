'use client';

import { useState, useCallback } from 'react';
import Image from '@/components/FolioImage';
import { X, Globe, Loader2, Check } from 'lucide-react';

interface Candidate {
  url: string;
  alt?: string;
}

interface WebsiteImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Called after images are added, so the page can refresh. */
  onComplete: () => void;
}

/**
 * Import project photos from a portfolio/website URL. Wraps the existing
 * `/api/import/website` scrape → review → add flow (the same one used by the
 * New Project Wizard), so it works on any project, not just completed ones.
 */
export function WebsiteImportModal({
  open,
  onOpenChange,
  projectId,
  onComplete,
}: WebsiteImportModalProps) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setUrl('');
    setScraping(false);
    setError(null);
    setCandidates([]);
    setSelected(new Set());
    setSaving(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const startScrape = useCallback(async () => {
    if (!url.trim()) return;
    setScraping(true);
    setError(null);
    setCandidates([]);
    setSelected(new Set());
    try {
      const post = await fetch('/api/import/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, url: url.trim() }),
      });
      const pdata = await post.json();
      if (!post.ok) {
        setError(pdata.error || 'Import failed.');
        return;
      }
      // Scrape runs synchronously; read the resolved session.
      const sess = await fetch(`/api/import/${pdata.sessionId}`).then(r => r.json());
      if (sess.status === 'READY_FOR_REVIEW') {
        const cands: Candidate[] = sess.processingMeta?.candidates || [];
        if (cands.length === 0) {
          setError('We couldn’t find any images on that page.');
          return;
        }
        setCandidates(cands);
        setSelected(new Set(cands.map(c => c.url)));
      } else {
        setError(sess.errorMessage || 'We couldn’t find any images on that page.');
      }
    } catch {
      setError('Something went wrong importing that URL.');
    } finally {
      setScraping(false);
    }
  }, [url, projectId]);

  const toggle = (u: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });

  const confirm = useCallback(async () => {
    const chosen = candidates.filter(c => selected.has(c.url));
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      for (const c of chosen) {
        try {
          await fetch(`/api/projects/${projectId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: c.url, name: c.alt }),
          });
        } catch {
          /* skip individual failures */
        }
      }
      onComplete();
      close();
    } finally {
      setSaving(false);
    }
  }, [candidates, selected, projectId, onComplete, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={close} />

      <div className="relative warm-mesh rounded-2xl bg-surface-ground border border-folio-border-subtle shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="relative z-[1] p-7 pb-4 shrink-0">
          <button
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-headline italic text-3xl text-folio-text-primary">Import from a URL</h2>
          <p className="folio-body text-folio-text-secondary mt-1.5">
            Paste a project or portfolio page and we’ll pull the photos from it.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-folio-text-tertiary" />
              <input
                autoFocus
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startScrape()}
                placeholder="https://example.com/project"
                className="w-full pl-9 pr-3 py-2.5 folio-ui rounded-xl border border-folio-border-subtle bg-surface-canvas focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              onClick={startScrape}
              disabled={scraping || !url.trim()}
              className="px-5 py-2.5 folio-ui font-semibold text-white bg-[var(--accent)] rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap inline-flex items-center gap-2"
            >
              {scraping ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {scraping ? 'Scanning…' : 'Find photos'}
            </button>
          </div>

          {error && (
            <p className="mt-3 folio-meta text-[rgb(74,44,59)] bg-stone-100 border border-stone-300 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {candidates.length > 0 && (
          <>
            <div className="relative z-[1] px-7 overflow-y-auto flex-1">
              <p className="folio-meta text-folio-text-secondary mb-3">
                {selected.size} of {candidates.length} selected
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-4">
                {candidates.map(c => {
                  const on = selected.has(c.url);
                  return (
                    <button
                      key={c.url}
                      onClick={() => toggle(c.url)}
                      className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                        on ? 'border-[var(--accent)]' : 'border-folio-border-subtle opacity-60'
                      }`}
                    >
                      <Image
                        src={c.url}
                        alt={c.alt || 'Candidate photo'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        unoptimized
                      />
                      {on && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative z-[1] p-7 pt-4 shrink-0 border-t border-folio-border-subtle flex justify-end gap-3">
              <button
                onClick={close}
                className="px-4 py-2.5 folio-ui font-medium text-folio-text-secondary border border-folio-border-subtle rounded-xl hover:bg-surface-ground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={saving || selected.size === 0}
                className="px-5 py-2.5 folio-ui font-semibold text-white bg-[var(--accent)] rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Adding…' : `Add ${selected.size} photo${selected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
