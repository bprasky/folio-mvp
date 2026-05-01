'use client';

import { useState } from 'react';
import type { AspectRatio } from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

interface ExportConfig {
  aspectRatio: AspectRatio;
  watermarkStyle: WatermarkStyle;
  headlinePosition: HeadlinePosition;
  headline: string;
  bioEnabled: boolean;
  bioText?: string;
  slideCount: 3 | 4 | 5;
  selectedImageUrls: string[];
  roomId?: string;
}

interface Props {
  projectId: string;
  config: ExportConfig;
  caption: string;
}

export function ExportButton({ projectId, config, caption }: Props) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  const handleExport = async () => {
    if (!config.headline) {
      alert('Please select a headline first.');
      return;
    }

    setExporting(true);
    setProgress('Generating images...');

    try {
      const res = await fetch('/api/instagram-export/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          config: {
            aspectRatio: config.aspectRatio,
            watermarkStyle: config.watermarkStyle,
            headlinePosition: config.headlinePosition,
            headline: config.headline,
            bioEnabled: config.bioEnabled,
            bioText: config.bioText,
            slideCount: config.slideCount,
            selectedImageUrls: config.selectedImageUrls,
            roomId: config.roomId,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate images');
      }

      const data = await res.json();
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
        const ctaText = 'The full editorial \u2014 and every product specification \u2014 lives on Folio.';
        const fullCaption = `${caption}\n\n${ctaText}`;
        try {
          await navigator.clipboard.writeText(fullCaption);
        } catch {
          // Clipboard not available, that's ok
        }
      }

      setProgress('Done! Images downloaded.');
      setTimeout(() => setProgress(''), 3000);
    } catch (error: any) {
      console.error('Export failed:', error);
      setProgress('');
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {progress && (
        <span style={{ fontSize: 'var(--type-meta)', color: '#8B7B68' }}>{progress}</span>
      )}
      <button
        onClick={handleExport}
        disabled={exporting || !config.headline}
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
          opacity: !config.headline && !exporting ? 0.4 : 1,
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
            Exporting...
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
}
