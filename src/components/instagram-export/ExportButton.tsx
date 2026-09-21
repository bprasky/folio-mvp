'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

export interface ExportConfig {
  studioCardId?: string; studioRevision?: string;
  aspectRatio: AspectRatio;
  watermarkStyle: WatermarkStyle;
  headlinePosition: HeadlinePosition;
  headline: string;
  bioEnabled: boolean;
  bioText?: string;
  slideCount: 2 | 3 | 4 | 5;
  selectedImageUrls: string[];
  roomId?: string;
  pitch?: string; rationale?: string; beats?: string[]; headlineOptions?: string[]; captionOptions?: string[];
}

interface Props {
  initialExport?: { id: string; updatedAt?: string } | null;
  projectId: string;
  config: ExportConfig;
  caption: string;
  onSaved?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export const ExportButton = forwardRef<{ saveDraft: () => Promise<boolean> }, Props>(function ExportButton({ projectId, config, caption, initialExport, onSaved, onBusyChange }, ref) {
  const [exporting, setExporting] = useState(false);
  const [savedExport, setSavedExport] = useState(initialExport);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleExport = async (saveOnly = false) => {
    if (!saveOnly && (!config.headline.trim() || !config.selectedImageUrls.length)) {
      setError('Add a headline and at least one photo before exporting.');
      return false;
    }

    if (exporting) return false;
    setExporting(true);
    onBusyChange?.(true);
    setError('');
    setProgress(saveOnly ? 'Saving draft...' : 'Generating images...');

    try {
      const res = await fetch('/api/instagram-export/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          caption,
          saveOnly,
          exportId: savedExport?.id,
          expectedUpdatedAt: savedExport?.updatedAt,
          config: {
            studioCardId: config.studioCardId, studioRevision: config.studioRevision,
            aspectRatio: config.aspectRatio,
            watermarkStyle: config.watermarkStyle,
            headlinePosition: config.headlinePosition,
            headline: config.headline,
            bioEnabled: config.bioEnabled,
            bioText: config.bioText,
            slideCount: config.slideCount,
            selectedImageUrls: config.selectedImageUrls,
            roomId: config.roomId,
            pitch: config.pitch, rationale: config.rationale, beats: config.beats,
            headlineOptions: config.headlineOptions, captionOptions: config.captionOptions,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate images');
      }

      const data = await res.json();
      setSavedExport(data.export);
      const url = new URL(window.location.href);
      url.searchParams.set('export', data.export.id);
      url.searchParams.delete('proposal');
      url.searchParams.delete('revision');
      window.history.replaceState(window.history.state, '', url);
      onSaved?.();
      if (saveOnly) {
        setProgress('Draft saved');
        return true;
      }
      setProgress('Downloading...');

      // Download each image
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const link = document.createElement('a');
        link.href = img.dataUrl;
        link.download = `folio-carousel-${i + 1}-${img.type}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads
        if (i < data.images.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Also copy caption to clipboard
      if (caption) {
        try {
          await navigator.clipboard.writeText(caption);
        } catch {
          // Clipboard not available, that's ok
        }
      }

      setProgress('Done! Images downloaded.');
      setTimeout(() => setProgress(''), 3000);
      return true;
    } catch (error: any) {
      console.error('Export failed:', error);
      setProgress('');
      setError(error.message || 'Could not save carousel. Please try again.');
      return false;
    } finally {
      setExporting(false);
      onBusyChange?.(false);
    }
  };

  useImperativeHandle(ref, () => ({ saveDraft: () => handleExport(true) }));

  const unavailable = !config.headline.trim() || !config.selectedImageUrls.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
      {error && <span role="alert" style={{ color: '#A33', fontSize: 'var(--type-meta)' }}>{error}</span>}
      <button onClick={() => handleExport(true)} disabled={exporting} style={{ padding: '10px 16px', border: '1px solid #E8E0D8', borderRadius: '10px', fontSize: 'var(--type-meta)' }}>Save draft</button>
      {unavailable && !exporting && <span className="folio-meta text-folio-text-secondary">Add a headline and photo to export.</span>}
      {progress && (
        <span style={{ fontSize: 'var(--type-meta)', color: '#8B7B68' }}>{progress}</span>
      )}
      <button
        onClick={() => handleExport()}
        disabled={exporting || unavailable}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: '10px',
          padding: '10px 20px',
          fontSize: 'var(--type-meta)',
          fontWeight: 'var(--w-h1)',
          border: 'none',
          cursor: exporting || !config.headline ? 'default' : 'pointer',
          transition: 'all 0.2s',
          background: exporting ? '#E8E0D8' : '#2C2420',
          color: exporting ? '#8B7B68' : '#FFFFFF',
          opacity: unavailable && !exporting ? 0.4 : 1,
        }}
      >
        {exporting ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid #8B7B68',
              borderTopColor: '#FFFFFF',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            {progress.startsWith('Saving') ? 'Saving…' : 'Exporting…'}
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2V10.5M8 10.5L11 7.5M8 10.5L5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 12H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Export Carousel
          </>
        )}
      </button>
    </div>
  );
});
