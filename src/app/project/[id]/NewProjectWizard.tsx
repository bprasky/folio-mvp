'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaArrowLeft,
  FaLink,
  FaCloudUploadAlt,
  FaCheck,
  FaSpinner,
  FaExclamationTriangle,
  FaTrash,
  FaMagic,
} from 'react-icons/fa';
import { InterviewModal } from '@/components/posting/interview/InterviewModal';

/**
 * New Project Wizard — guided setup for completed ("PAST" timeline) projects.
 *
 * Step 1 Photos: import from a portfolio URL (Pro, behind `canScrape`) or
 *   upload directly. Step 2 Rooms: label photos into rooms. Step 3 Done:
 *   land in the project, optionally start the AI interview.
 *
 * Spec/presentation extraction and the in-wizard interview step are layered in
 * by later phases; for now those happen from the project's media tab.
 */

interface AddedImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
}

interface Candidate {
  url: string;
  alt?: string;
}

interface NewProjectWizardProps {
  project: {
    id: string;
    title: string;
    description?: string | null;
    [key: string]: unknown;
  };
  canScrape: boolean;
}

const STEPS = ['Photos', 'Rooms', 'Specs', 'Done'];

interface SpecTag {
  id: string;
  description: string;
  extractedVendor?: string | null;
  extractedPrice?: number | null; // cents
  extractedDimensions?: string | null;
  extractedSku?: string | null;
  extractedMaterial?: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewProjectWizard({ project, canScrape }: NewProjectWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<AddedImage[]>([]);

  // ---- Step 1: scrape ----
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scrapeSessionId, setScrapeSessionId] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [extractedDescription, setExtractedDescription] = useState('');
  const [savingPhotos, setSavingPhotos] = useState(false);

  // ---- Step 1: manual upload ----
  const [uploading, setUploading] = useState(false);

  // ---- Step 2: rooms ----
  const [rooms, setRooms] = useState<string[]>([]);
  const [newRoom, setNewRoom] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detectedOnce, setDetectedOnce] = useState(false);

  // ---- Step 3: specs ----
  const [specUploading, setSpecUploading] = useState(false);
  const [specSessionId, setSpecSessionId] = useState<string | null>(null);
  const [specTags, setSpecTags] = useState<SpecTag[]>([]);
  const [removedSpecIds, setRemovedSpecIds] = useState<Set<string>>(new Set());
  const [specError, setSpecError] = useState<string | null>(null);
  const [specFinalizing, setSpecFinalizing] = useState(false);
  const [specsSaved, setSpecsSaved] = useState(0);

  // ---- Step 4 ----
  const [interviewOpen, setInterviewOpen] = useState(false);

  const goToProject = useCallback(() => {
    router.push(`/project/${project.id}?view=media`);
  }, [router, project.id]);

  // ---------------- Specs ----------------
  const onSpecFile = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setSpecError('Please upload a PDF spec sheet.');
        return;
      }
      setSpecUploading(true);
      setSpecError(null);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`/api/projects/${project.id}/import-spec`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) {
          setSpecError(data.error || 'Could not read that PDF.');
          return;
        }
        if (!data.tagCount) {
          setSpecError('No product specifications were found in that PDF.');
          return;
        }
        setSpecSessionId(data.sessionId);
        const tagsRes = await fetch(`/api/import/${data.sessionId}/pending-tags?limit=200`).then((r) => r.json());
        setSpecTags(tagsRes.pendingTags || []);
        setRemovedSpecIds(new Set());
      } catch {
        setSpecError('Something went wrong reading that PDF.');
      } finally {
        setSpecUploading(false);
      }
    },
    [project.id]
  );

  const toggleSpecRemoved = (id: string) => {
    setRemovedSpecIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const finalizeSpecs = useCallback(async () => {
    if (!specSessionId) return;
    const kept = specTags.filter((t) => !removedSpecIds.has(t.id));
    setSpecFinalizing(true);
    try {
      const res = await fetch(`/api/import/${specSessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          rooms: [{ type: 'other', name: 'Specifications' }],
          products: kept.map((t) => ({ pendingTagId: t.id, roomType: 'other' })),
        }),
      });
      const data = await res.json();
      setSpecsSaved(data.selectionsCreated ?? kept.length);
    } catch {
      /* non-blocking: still advance */
    } finally {
      setSpecFinalizing(false);
      setStep(4);
    }
  }, [specSessionId, specTags, removedSpecIds, project.id]);

  // ---------------- Scrape ----------------
  const startScrape = useCallback(async () => {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError(null);
    setCandidates([]);
    setSelected(new Set());
    try {
      const post = await fetch('/api/import/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, url: url.trim() }),
      });
      const pdata = await post.json();
      if (!post.ok) {
        setScrapeError(pdata.error || 'Import failed.');
        setScraping(false);
        return;
      }
      // The scrape runs synchronously; read the resolved session.
      const sess = await fetch(`/api/import/${pdata.sessionId}`).then((r) => r.json());
      setScrapeSessionId(pdata.sessionId);
      if (sess.status === 'READY_FOR_REVIEW') {
        const meta = sess.processingMeta || {};
        const cands: Candidate[] = meta.candidates || [];
        setCandidates(cands);
        setSelected(new Set(cands.map((c) => c.url)));
        setExtractedDescription(meta.extractedDescription || '');
      } else {
        setScrapeError(sess.errorMessage || 'We couldn’t find any images on that page.');
      }
    } catch {
      setScrapeError('Something went wrong importing that URL.');
    } finally {
      setScraping(false);
    }
  }, [url, project.id]);

  const reportIssue = useCallback(() => {
    fetch('/api/support/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, errorType: 'website_import', errorMessage: scrapeError }),
    }).catch(() => {});
    setScrapeError('Thanks — we’ve logged it. You can upload photos directly below.');
  }, [url, scrapeError]);

  const toggleCandidate = (u: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });
  };

  const confirmScraped = useCallback(async () => {
    const chosen = candidates.filter((c) => selected.has(c.url));
    if (chosen.length === 0) return;
    setSavingPhotos(true);
    const added: AddedImage[] = [];
    for (const c of chosen) {
      try {
        const res = await fetch(`/api/projects/${project.id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: c.url, name: c.alt }),
        });
        if (res.ok) {
          const d = await res.json();
          added.push({ id: d.image.id, url: d.image.url, name: d.image.name });
        }
      } catch {
        /* skip individual failures */
      }
    }
    setImages((prev) => [...prev, ...added]);

    // Persist scraped description only if the project doesn't already have one.
    if (extractedDescription.trim() && !project.description) {
      fetch(`/api/designer/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: extractedDescription.trim() }),
      }).catch(() => {});
    }
    // Mark the import session complete.
    if (scrapeSessionId) {
      fetch(`/api/import/${scrapeSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      }).catch(() => {});
    }

    setCandidates([]);
    setSelected(new Set());
    setScrapeSessionId(null);
    setExtractedDescription('');
    setUrl('');
    setSavingPhotos(false);
  }, [candidates, selected, project.id, project.description, extractedDescription, scrapeSessionId]);

  // ---------------- Manual upload ----------------
  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      const added: AddedImage[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const base64 = await fileToBase64(file);
          const res = await fetch(`/api/projects/${project.id}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64, mimeType: file.type, name: file.name }),
          });
          if (res.ok) {
            const d = await res.json();
            added.push({ id: d.image.id, url: d.image.url, name: d.image.name });
          }
        } catch {
          /* skip */
        }
      }
      setImages((prev) => [...prev, ...added]);
      setUploading(false);
    },
    [project.id]
  );

  const removeImage = useCallback(
    async (imageId: string) => {
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      fetch(`/api/projects/${project.id}/images/${imageId}`, { method: 'DELETE' }).catch(() => {});
    },
    [project.id]
  );

  // ---------------- Rooms ----------------
  const addRoom = useCallback(async () => {
    const name = newRoom.trim();
    if (!name || rooms.includes(name)) {
      setNewRoom('');
      return;
    }
    setRooms((prev) => [...prev, name]);
    setNewRoom('');
    // Create a Room record (best-effort; the label on the image is what groups media).
    fetch(`/api/designer/projects/${project.id}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {});
  }, [newRoom, rooms, project.id]);

  const assignRoom = useCallback(
    async (imageId: string, room: string) => {
      setImages((prev) => prev.map((i) => (i.id === imageId ? { ...i, room: room || null } : i)));
      fetch(`/api/projects/${project.id}/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: room || null }),
      }).catch(() => {});
    },
    [project.id]
  );

  // AI room detection: classify every photo's room type and pre-fill labels.
  const runDetect = useCallback(async () => {
    if (images.length === 0) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/detect-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetectError(data.error || 'Could not detect rooms.');
        return;
      }
      const assignments: Record<string, string> = data.assignments || {};
      const detectedRooms: string[] = data.rooms || [];
      setRooms((prev) => Array.from(new Set([...prev, ...detectedRooms])));
      setImages((prev) => prev.map((i) => (assignments[i.id] ? { ...i, room: assignments[i.id] } : i)));
    } catch {
      setDetectError('Something went wrong detecting rooms.');
    } finally {
      setDetecting(false);
      setDetectedOnce(true);
    }
  }, [images.length, project.id]);

  // Auto-run detection once when the designer first reaches the Rooms step.
  useEffect(() => {
    if (step === 2 && images.length > 0 && !detectedOnce && !detecting) {
      runDetect();
    }
  }, [step, images.length, detectedOnce, detecting, runDetect]);

  // ---------------- Render ----------------
  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Back nav */}
      <div className="p-4 bg-surface-ground border-b border-folio-border-subtle">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors folio-ui"
          >
            <FaArrowLeft className="mr-2 w-3 h-3" /> Back to Projects
          </Link>
          <button onClick={goToProject} className="folio-meta text-folio-text-tertiary hover:text-folio-text-primary">
            Exit setup
          </button>
        </div>
      </div>

      {/* Header + step indicator */}
      <header className="max-w-3xl mx-auto px-6 pt-10 text-center">
        <h1 className="font-serif italic text-3xl text-folio-text-primary tracking-tight">{project.title}</h1>
        <div className="mt-6 flex items-center justify-center gap-3">
          {STEPS.map((label, idx) => {
            const n = idx + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={label} className="flex items-center gap-3">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--accent)] text-white'
                      : done
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                        : 'bg-surface-ground text-folio-text-tertiary border border-folio-border-subtle'
                  }`}
                >
                  {done ? <FaCheck className="w-3 h-3" /> : n}
                </span>
                <span className={`folio-meta ${active ? 'text-folio-text-primary' : 'text-folio-text-tertiary'}`}>
                  {label}
                </span>
                {n < STEPS.length && <span className="text-[var(--ridge-outer)]">—</span>}
              </div>
            );
          })}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* ---------------- STEP 1: PHOTOS ---------------- */}
        {step === 1 && (
          <div>
            <h2 className="folio-body text-lg text-folio-text-primary text-center mb-2">Add your project photos</h2>
            <p className="folio-meta text-folio-text-tertiary text-center mb-8">
              {canScrape
                ? 'Paste a link to the project online, or upload photos directly.'
                : 'Upload photos of the finished project.'}
            </p>

            {/* Path A: scrape (Pro only) */}
            {canScrape && candidates.length === 0 && (
              <div className="mb-8">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FaLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-folio-text-tertiary" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startScrape()}
                      placeholder="https://your-portfolio.com/project"
                      disabled={scraping}
                      className="w-full h-12 pl-11 pr-4 rounded-xl bg-surface-ground border border-folio-border-subtle focus:border-[var(--accent)] focus:outline-none folio-body text-folio-text-primary"
                    />
                  </div>
                  <button
                    onClick={startScrape}
                    disabled={scraping || !url.trim()}
                    className="accent-btn px-6 disabled:opacity-50 flex items-center gap-2"
                  >
                    {scraping ? <FaSpinner className="w-4 h-4 animate-spin" /> : null}
                    {scraping ? 'Importing…' : 'Import'}
                  </button>
                </div>
                {scrapeError && (
                  <div className="mt-3 flex items-start gap-2 text-folio-text-secondary folio-meta">
                    <FaExclamationTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
                    <span>
                      {scrapeError}{' '}
                      <button onClick={reportIssue} className="underline hover:text-folio-text-primary">
                        Report this issue
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Candidate review */}
            {candidates.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="folio-meta text-folio-text-secondary">
                    Found {candidates.length} image{candidates.length === 1 ? '' : 's'} — {selected.size} selected
                  </p>
                  <button onClick={() => setCandidates([])} className="folio-meta text-folio-text-tertiary hover:text-folio-text-primary">
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {candidates.map((c) => {
                    const isSel = selected.has(c.url);
                    return (
                      <button
                        key={c.url}
                        onClick={() => toggleCandidate(c.url)}
                        className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                          isSel ? 'border-[var(--accent)]' : 'border-folio-border-subtle opacity-60 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.url} alt={c.alt || ''} className="w-full h-full object-cover" />
                        {isSel && (
                          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--accent)] text-white flex items-center justify-center">
                            <FaCheck className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Editable scraped description */}
                {extractedDescription && (
                  <div className="mt-5">
                    <label className="folio-meta text-folio-text-tertiary block mb-1">
                      Project description (from the page — edit or clear)
                    </label>
                    <textarea
                      value={extractedDescription}
                      onChange={(e) => setExtractedDescription(e.target.value)}
                      rows={3}
                      className="w-full p-3 rounded-xl bg-surface-ground border border-folio-border-subtle focus:border-[var(--accent)] focus:outline-none folio-body text-folio-text-primary"
                    />
                  </div>
                )}

                <button
                  onClick={confirmScraped}
                  disabled={savingPhotos || selected.size === 0}
                  className="accent-btn px-6 py-3 mt-5 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPhotos ? <FaSpinner className="w-4 h-4 animate-spin" /> : null}
                  {savingPhotos ? 'Adding…' : `Add ${selected.size} photo${selected.size === 1 ? '' : 's'}`}
                </button>
              </div>
            )}

            {/* Path B: manual upload */}
            {candidates.length === 0 && (
              <label className="block border-2 border-dashed border-folio-border-subtle rounded-2xl p-10 text-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                  disabled={uploading}
                />
                <FaCloudUploadAlt
                  className={`w-10 h-10 mx-auto mb-3 ${uploading ? 'text-[var(--accent)] animate-pulse' : 'text-folio-text-tertiary'}`}
                />
                <p className="folio-body text-folio-text-primary">
                  {uploading ? 'Uploading…' : 'Click to upload photos'}
                </p>
                <p className="folio-meta text-folio-text-tertiary mt-1">JPG, PNG, or WebP</p>
              </label>
            )}

            {/* Added images so far */}
            {images.length > 0 && (
              <div className="mt-8">
                <p className="folio-meta text-folio-text-secondary mb-3">{images.length} photo{images.length === 1 ? '' : 's'} added</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-folio-border-subtle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.name || ''} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        aria-label="Remove photo"
                      >
                        <FaTrash className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-10">
              <button
                onClick={() => setStep(2)}
                disabled={images.length === 0}
                className="accent-btn px-8 py-3 disabled:opacity-40"
              >
                Next: Label rooms
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 2: ROOMS ---------------- */}
        {step === 2 && (
          <div>
            <h2 className="folio-body text-lg text-folio-text-primary text-center mb-2">Organize photos into rooms</h2>
            <p className="folio-meta text-folio-text-tertiary text-center mb-4">
              {detecting
                ? 'AI is sorting your photos into rooms…'
                : detectedOnce
                  ? 'We sorted your photos into rooms — review and refine below.'
                  : 'Create room labels, then assign each photo. You can skip this and do it later.'}
            </p>

            {/* AI auto-detect */}
            <div className="flex justify-center mb-8">
              {detecting ? (
                <span className="inline-flex items-center gap-2 folio-meta text-[var(--accent)]">
                  <FaSpinner className="w-4 h-4 animate-spin" /> Detecting rooms with AI…
                </span>
              ) : (
                <button
                  onClick={runDetect}
                  disabled={images.length === 0}
                  className="ridge-btn px-5 py-2 flex items-center gap-2 disabled:opacity-50"
                >
                  <FaMagic className="w-3.5 h-3.5" />
                  {detectedOnce ? 'Re-detect rooms' : 'Auto-detect rooms with AI'}
                </button>
              )}
            </div>
            {detectError && (
              <p className="text-center folio-meta text-folio-text-secondary mb-6">{detectError}</p>
            )}

            {/* Add room label */}
            <div className="flex gap-2 mb-6 max-w-md mx-auto">
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRoom()}
                placeholder="e.g. Living Room, Primary Bath"
                className="flex-1 h-11 px-4 rounded-xl bg-surface-ground border border-folio-border-subtle focus:border-[var(--accent)] focus:outline-none folio-body"
              />
              <button onClick={addRoom} disabled={!newRoom.trim()} className="ridge-btn px-5 disabled:opacity-50">
                Add room
              </button>
            </div>

            {rooms.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {rooms.map((r) => (
                  <span key={r} className="px-3 py-1 rounded-full bg-surface-ground border border-folio-border-subtle folio-meta text-folio-text-secondary">
                    {r}
                  </span>
                ))}
              </div>
            )}

            {/* Assign each image */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden border border-folio-border-subtle">
                  <div className="aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name || ''} className="w-full h-full object-cover" />
                  </div>
                  <select
                    value={img.room || ''}
                    onChange={(e) => assignRoom(img.id, e.target.value)}
                    className="w-full p-2 bg-surface-ground border-t border-folio-border-subtle folio-meta text-folio-text-primary focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {rooms.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-10">
              <button onClick={() => setStep(1)} className="ridge-btn px-6 py-3">
                Back
              </button>
              <button onClick={() => setStep(3)} className="accent-btn px-8 py-3">
                Next: Specs
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STEP 3: SPECS ---------------- */}
        {step === 3 && (
          <div>
            <h2 className="folio-body text-lg text-folio-text-primary text-center mb-2">Import product specs</h2>
            <p className="folio-meta text-folio-text-tertiary text-center mb-8">
              Upload a spec sheet or FF&amp;E PDF and we&apos;ll pull out the products. Optional — you can skip this.
            </p>

            {specTags.length === 0 ? (
              <>
                <label className="block border-2 border-dashed border-folio-border-subtle rounded-2xl p-10 text-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => onSpecFile(e.target.files)}
                    disabled={specUploading}
                  />
                  <FaCloudUploadAlt
                    className={`w-10 h-10 mx-auto mb-3 ${specUploading ? 'text-[var(--accent)] animate-pulse' : 'text-folio-text-tertiary'}`}
                  />
                  <p className="folio-body text-folio-text-primary">
                    {specUploading ? 'Reading specs… this can take a minute' : 'Click to upload a spec PDF'}
                  </p>
                  <p className="folio-meta text-folio-text-tertiary mt-1">PDF up to 50MB</p>
                </label>
                {specError && (
                  <p className="mt-3 text-center folio-meta text-folio-text-secondary">{specError}</p>
                )}
              </>
            ) : (
              <div>
                <p className="folio-meta text-folio-text-secondary mb-3">
                  Found {specTags.length} product{specTags.length === 1 ? '' : 's'} —{' '}
                  {specTags.length - removedSpecIds.size} will be added. Uncheck anything you don&apos;t want.
                </p>
                <div className="space-y-2">
                  {specTags.map((t) => {
                    const removed = removedSpecIds.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          removed ? 'border-folio-border-subtle opacity-50' : 'border-folio-border-subtle bg-surface-ground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!removed}
                          onChange={() => toggleSpecRemoved(t.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <p className="folio-body text-folio-text-primary truncate">{t.description}</p>
                          <p className="folio-meta text-folio-text-tertiary">
                            {[
                              t.extractedVendor,
                              typeof t.extractedPrice === 'number' ? `$${(t.extractedPrice / 100).toLocaleString()}` : null,
                              t.extractedDimensions,
                              t.extractedSku ? `SKU ${t.extractedSku}` : null,
                              t.extractedMaterial,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'No additional details extracted'}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-10">
              <button onClick={() => setStep(2)} className="ridge-btn px-6 py-3">
                Back
              </button>
              {specTags.length === 0 ? (
                <button onClick={() => setStep(4)} className="accent-btn px-8 py-3">
                  Skip for now
                </button>
              ) : (
                <button onClick={finalizeSpecs} disabled={specFinalizing} className="accent-btn px-8 py-3 disabled:opacity-50 flex items-center gap-2">
                  {specFinalizing ? <FaSpinner className="w-4 h-4 animate-spin" /> : null}
                  {specFinalizing ? 'Saving…' : `Add ${specTags.length - removedSpecIds.size} to project`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------------- STEP 4: DONE ---------------- */}
        {step === 4 && (
          <div className="text-center pt-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mb-5">
              <FaCheck className="w-6 h-6" />
            </div>
            <h2 className="font-serif italic text-2xl text-folio-text-primary mb-2">Your project is set up</h2>
            <p className="folio-body text-folio-text-secondary max-w-md mx-auto">
              {images.length} photo{images.length === 1 ? '' : 's'}
              {rooms.length > 0 ? ` across ${rooms.length} room${rooms.length === 1 ? '' : 's'}` : ''}
              {specsSaved > 0 ? `, ${specsSaved} product spec${specsSaved === 1 ? '' : 's'}` : ''} added. Add more
              photos, specs, and product tags any time from the project&apos;s media tab.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => setInterviewOpen(true)} className="accent-btn px-6 py-3">
                Start AI interview
              </button>
              <button onClick={goToProject} className="ridge-btn px-6 py-3">
                Go to project
              </button>
            </div>
          </div>
        )}
      </main>

      <InterviewModal
        open={interviewOpen}
        onOpenChange={(open) => {
          setInterviewOpen(open);
          if (!open) goToProject();
        }}
        projectId={project.id}
        projectName={project.title}
        images={images.map((i) => ({ id: i.id, url: i.url, name: i.name ?? undefined }))}
      />
    </div>
  );
}
