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
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
            <LinkIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-stone-900 dark:text-stone-100">
              Enter Product URL
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              We'll automatically extract product information
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
              Product Page URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com/products/terra-travertine-side-table"
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">We'll extract:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-300">
                  <li>Product name, description, and SKU</li>
                  <li>Images and media files</li>
                  <li>Specifications and dimensions</li>
                  <li>PDF spec sheets and 3D files</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={onSkip}
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
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




