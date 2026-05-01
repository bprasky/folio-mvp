'use client';

import { useState, useCallback } from 'react';
import { GlassModal, GlassModalHeader, GlassModalBody, GlassModalFooter } from '@/components/ui/glass-modal';

interface AddRecognitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onSuccess?: () => void;
}

const RECOGNITION_TYPES = [
  { id: 'PUBLICATION', label: 'Publication' },
  { id: 'AWARD', label: 'Award' },
  { id: 'PRESS', label: 'Press' },
  { id: 'OTHER', label: 'Other' },
] as const;

export default function AddRecognitionModal({
  open,
  onOpenChange,
  orgId,
  onSuccess,
}: AddRecognitionModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [type, setType] = useState<string>('PUBLICATION');
  const [date, setDate] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setUrl('');
    setTitle('');
    setSource('');
    setType('PUBLICATION');
    setDate('');
    setExcerpt('');
    setImageUrl('');
  }, []);

  const handleUrlBlur = useCallback(async () => {
    if (!url || fetching) return;

    try {
      setFetching(true);
      const res = await fetch('/api/og-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title && !title) setTitle(data.title);
        if (data.siteName && !source) setSource(data.siteName);
        if (data.imageUrl && !imageUrl) setImageUrl(data.imageUrl);
      }
    } catch {
      // Silently fail — user can fill fields manually
    } finally {
      setFetching(false);
    }
  }, [url, fetching, title, source, imageUrl]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    try {
      setSaving(true);
      const body: Record<string, any> = {
        title: title.trim(),
        type,
      };

      if (url.trim()) body.url = url.trim();
      if (source.trim()) body.source = source.trim();
      if (excerpt.trim()) body.excerpt = excerpt.trim();
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (date) body.date = new Date(date + '-01').toISOString();

      const res = await fetch(`/api/orgs/${orgId}/recognition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetForm();
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to save recognition:', error);
    } finally {
      setSaving(false);
    }
  }, [orgId, title, type, url, source, excerpt, imageUrl, date, resetForm, onOpenChange, onSuccess]);

  return (
    <GlassModal open={open} onOpenChange={onOpenChange} size="md">
      <GlassModalHeader>
        <div className="flex items-center justify-between">
          <h3
            className="text-lg font-medium text-folio-text-primary"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            Add a Recognition
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm hover:opacity-70 text-folio-text-secondary"
          >
            &#10005;
          </button>
        </div>
      </GlassModalHeader>

      <GlassModalBody>
        <div className="flex flex-col gap-5">
          {/* URL field */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Paste a link (optional)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://luxeinteriors.com/feature/..."
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-folio-border-subtle bg-surface-ground text-folio-text-primary outline-none transition-colors focus:border-[var(--folio-gold)]"
            />
            {fetching && (
              <p className="text-xs mt-1" style={{ color: 'var(--folio-gold)' }}>
                Fetching details...
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Featured in Luxe Interiors + Design"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-folio-border-subtle bg-surface-ground text-folio-text-primary outline-none transition-colors focus:border-[var(--folio-gold)]"
            />
          </div>

          {/* Publication / Source */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Publication / Source
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Luxe Interiors + Design"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-folio-border-subtle bg-surface-ground text-folio-text-primary outline-none transition-colors focus:border-[var(--folio-gold)]"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {RECOGNITION_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className="px-4 py-1.5 text-xs rounded-full transition-all"
                  style={{
                    backgroundColor: type === t.id ? '#2C2825' : 'transparent',
                    color: type === t.id ? 'var(--surface-ground)' : '#6B635B',
                    border: type === t.id ? 'none' : '1px solid #D4CEC6',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Date (optional)
            </label>
            <input
              type="month"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-folio-border-subtle bg-surface-ground text-folio-text-primary outline-none transition-colors focus:border-[var(--folio-gold)]"
            />
          </div>

          {/* Note / Excerpt */}
          <div>
            <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
              Note (optional)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Our Coral Gables residence was the cover story for the Spring 2024 issue."
              rows={3}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-folio-border-subtle bg-surface-ground text-folio-text-primary outline-none transition-colors focus:border-[var(--folio-gold)] resize-none"
            />
          </div>

          {/* Thumbnail preview */}
          {imageUrl && (
            <div>
              <label className="text-xs font-medium mb-1.5 block text-folio-text-secondary">
                Thumbnail
              </label>
              <div className="rounded-xl overflow-hidden border border-folio-border-subtle">
                <img
                  src={imageUrl}
                  alt="Thumbnail preview"
                  className="w-full h-40 object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </GlassModalBody>

      <GlassModalFooter>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80 text-folio-text-secondary"
            style={{ border: '1px solid #D4CEC6' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="px-5 py-2 text-sm rounded-full transition-all hover:opacity-80 disabled:opacity-50 bg-folio-text-primary text-surface-ground"
          >
            {saving ? 'Adding...' : 'Add Recognition'}
          </button>
        </div>
      </GlassModalFooter>
    </GlassModal>
  );
}
