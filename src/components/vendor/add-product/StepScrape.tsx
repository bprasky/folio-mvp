'use client';

import { useEffect, useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { scrapeProduct } from '@/app/vendor/products/actions';
import { ScrapeResult, Confidence } from '@/types/scrape';
import { collectLowConfidence } from '@/lib/vendor/mergeDraftWithScrape';
import { Loader2, CheckCircle, XCircle, Globe, AlertCircle } from 'lucide-react';

interface StepScrapeProps {
  url: string;
  onComplete: (data: ScrapeResult) => void;
  onBack: () => void;
}

export function StepScrape({ url, onComplete, onBack }: StepScrapeProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const [scrapedData, setScrapedData] = useState<ScrapeResult | null>(null);

  useEffect(() => {
    async function scrape() {
      setStatus('loading');
      
      try {
        const result = await scrapeProduct(url);
        
        if (result.success) {
          setScrapedData(result);
          setStatus('success');
        } else {
          setStatus('error');
          setError(result.error || 'Failed to scrape product information');
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'An unexpected error occurred');
      }
    }
    
    scrape();
  }, [url]);

  const hostname = new URL(url).hostname;

  // Calculate confidence stats
  const getConfidenceStats = (scraped: ScrapeResult) => {
    const lowConf = collectLowConfidence(scraped);
    const highConfFields: string[] = [];
    const medConfFields: string[] = [];
    
    // Count high/med confidence fields
    if (scraped.identity.name.confidence === 2) highConfFields.push('Name');
    else if (scraped.identity.name.confidence === 1) medConfFields.push('Name');
    
    if (scraped.identity.sku.confidence === 2) highConfFields.push('SKU');
    else if (scraped.identity.sku.confidence === 1) medConfFields.push('SKU');
    
    if (scraped.description.confidence === 2) highConfFields.push('Description');
    else if (scraped.description.confidence === 1) medConfFields.push('Description');
    
    if (scraped.media.heroImageUrl.confidence === 2 || scraped.media.heroVideoUrl.confidence === 2) highConfFields.push('Hero Media');
    else if (scraped.media.heroImageUrl.confidence === 1 || scraped.media.heroVideoUrl.confidence === 1) medConfFields.push('Hero Media');
    
    if (scraped.media.gallery.confidence >= 1 && scraped.media.gallery.value && scraped.media.gallery.value.length > 0) {
      if (scraped.media.gallery.confidence === 2) highConfFields.push(`${scraped.media.gallery.value.length} Gallery Images`);
      else medConfFields.push(`${scraped.media.gallery.value.length} Gallery Images`);
    }
    
    if (scraped.specs.materials.confidence >= 1) {
      if (scraped.specs.materials.confidence === 2) highConfFields.push('Materials');
      else medConfFields.push('Materials');
    }
    
    if (scraped.specs.finish.confidence >= 1) {
      if (scraped.specs.finish.confidence === 2) highConfFields.push('Finish');
      else medConfFields.push('Finish');
    }
    
    if (scraped.specs.dimensions.length.confidence >= 1) {
      if (scraped.specs.dimensions.length.confidence === 2) highConfFields.push('Dimensions');
      else medConfFields.push('Dimensions');
    }
    
    if (scraped.commerce.msrp.confidence >= 1) {
      if (scraped.commerce.msrp.confidence === 2) highConfFields.push('Price');
      else medConfFields.push('Price');
    }
    
    return {
      high: highConfFields.length,
      medium: medConfFields.length,
      low: lowConf.length,
      highFields: highConfFields,
      medFields: medConfFields,
      lowFields: lowConf.map(f => f.path),
    };
  };

  return (
    <GlassPanel>
      <div className="p-8">
        {status === 'loading' && (
          <div className="text-center py-12">
            <div className="relative inline-block mb-6">
              <Globe className="w-16 h-16 text-[var(--accent)] dark:text-blue-400" />
              <Loader2 className="w-6 h-6 text-[var(--accent)] dark:text-blue-400 animate-spin absolute -top-1 -right-1" />
            </div>
            <h2 className="text-2xl font-medium mb-2 text-stone-900 dark:text-stone-100">
              Scraping Product...
            </h2>
            <p className="text-stone-600 dark:text-stone-400 mb-4">
              Extracting product information from {hostname}
            </p>
            <div className="max-w-md mx-auto space-y-2 text-sm text-stone-500 dark:text-stone-400">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span>Fetching page content...</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse animation-delay-200" />
                <span>Parsing JSON-LD & OpenGraph...</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse animation-delay-400" />
                <span>Extracting images & files...</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse animation-delay-600" />
                <span>Analyzing specifications...</span>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && scrapedData && (
          <div className="py-8">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h2 className="text-2xl font-medium mb-2 text-stone-900 dark:text-stone-100">
                Extraction Complete!
              </h2>
              <p className="text-stone-600 dark:text-stone-400">
                Product data extracted with confidence scoring
              </p>
            </div>

            {/* Confidence Summary */}
            <div className="max-w-2xl mx-auto space-y-4 mb-8">
              {(() => {
                const stats = getConfidenceStats(scrapedData);
                return (
                  <>
                    {/* Confidence Score Cards */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
                          {stats.high}
                        </div>
                        <div className="text-xs uppercase tracking-wider text-green-700 dark:text-green-300 font-medium">
                          High Confidence
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                          {stats.medium}
                        </div>
                        <div className="text-xs uppercase tracking-wider text-yellow-700 dark:text-yellow-300 font-medium">
                          Medium Confidence
                        </div>
                      </div>
                      
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                          {stats.low}
                        </div>
                        <div className="text-xs uppercase tracking-wider text-red-700 dark:text-red-300 font-medium">
                          Needs Review
                        </div>
                      </div>
                    </div>

                    {/* Extracted Fields Preview */}
                    {stats.high > 0 && (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">
                            Auto-filled ({stats.high} fields)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stats.highFields.map((field, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 rounded-md bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.medium > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                            Review Recommended ({stats.medium} fields)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stats.medFields.map((field, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-1 rounded-md bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.low > 0 && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-900 dark:text-red-100">
                            Manual Entry Required ({stats.low} fields)
                          </span>
                        </div>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          These fields couldn't be extracted automatically
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onBack}
                className="px-6 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-stone-700 dark:text-stone-300"
              >
                Try Different URL
              </button>
              <Button onClick={() => onComplete(scrapedData)} size="lg">
                Continue to Mapping →
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-12">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-medium mb-2 text-stone-900 dark:text-stone-100">
              Scraping Failed
            </h2>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {error}
            </p>
            
            <div className="max-w-md mx-auto bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-left mb-6">
              <p className="text-sm text-red-900 dark:text-red-100">
                <span className="font-medium">Possible reasons:</span>
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside mt-2 space-y-1">
                <li>Page requires authentication</li>
                <li>Website blocks automated access</li>
                <li>Invalid or broken URL</li>
                <li>Network connectivity issue</li>
                <li>Browserless API key invalid/expired</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onBack}
                className="px-6 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Try Different URL
              </button>
              <Button onClick={() => onComplete(scrapedData!)}>
                Continue Manually
              </Button>
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
