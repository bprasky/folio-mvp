'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Sparkles } from 'lucide-react';

interface StepUrlProps {
  onNext: (url: string) => void;
  onSkip: () => void;
}

export function StepUrl({ onNext, onSkip }: StepUrlProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    try {
      new URL(url);
      setError('');
      onNext(url);
    } catch {
      setError('Please enter a valid URL (must start with http:// or https://)');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && url) {
      handleNext();
    }
  };

  return (
    <GlassPanel>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-[var(--accent)]/10 dark:bg-blue-900">
            <LinkIcon className="w-6 h-6 text-[var(--accent)] dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-folio-text-primary dark:text-folio-text-tertiary">
              Enter Product URL
            </h2>
            <p className="text-sm text-folio-text-secondary dark:text-folio-text-tertiary">
              We'll automatically extract product information
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-folio-text-secondary dark:text-folio-text-tertiary mb-2">
              Product Page URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com/products/terra-travertine-side-table"
              className="w-full px-4 py-3 rounded-xl border border-folio-border-strong dark:border-folio-border-subtle bg-surface-canvas dark:bg-surface-canvas text-folio-text-primary dark:text-folio-text-tertiary focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
            )}
          </div>

          <div className="bg-[var(--accent)]/5 dark:bg-blue-950 border border-[var(--accent)]/20 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[var(--accent)] dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">We'll extract:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[var(--accent-hover)] dark:text-blue-300">
                  <li>Product name, description, and SKU</li>
                  <li>Images and media files</li>
                  <li>Specifications and dimensions</li>
                  <li>PDF spec sheets and 3D files</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-folio-border-subtle dark:border-folio-border-subtle">
          <button
            onClick={onSkip}
            className="text-sm text-folio-text-secondary dark:text-folio-text-tertiary hover:text-folio-text-primary dark:hover:text-folio-text-tertiary transition-colors"
          >
            Skip & enter manually →
          </button>
          
          <Button 
            onClick={handleNext} 
            disabled={!url}
            className="min-w-[140px]"
          >
            Next: Scrape
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}




