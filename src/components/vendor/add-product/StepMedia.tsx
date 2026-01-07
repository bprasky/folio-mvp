'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ProductDraft } from '@/types/vendor-product';
import { extractPalette } from '@/lib/vendor/extractPalette';
import { Image as ImageIcon, Video, Upload, X, Palette as PaletteIcon, Loader2 } from 'lucide-react';

interface StepMediaProps {
  initialData: Partial<ProductDraft>;
  onNext: (data: Partial<ProductDraft>) => void;
  onBack: () => void;
}

export function StepMedia({ initialData, onNext, onBack }: StepMediaProps) {
  const [heroType, setHeroType] = useState<'image' | 'video'>(initialData.heroMedia?.type || 'image');
  const [heroUrl, setHeroUrl] = useState(initialData.heroMedia?.url || '');
  const [heroAlt, setHeroAlt] = useState(initialData.heroMedia?.alt || '');
  const [galleryItems, setGalleryItems] = useState<Array<{ type: 'image' | 'video'; url: string; alt?: string }>>(
    initialData.gallery || []
  );
  const [palette, setPalette] = useState(initialData.palette);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');

  const handleHeroChange = async (url: string) => {
    setHeroUrl(url);
    setError('');

    // Auto-extract palette from hero image
    if (heroType === 'image' && url) {
      try {
        setExtracting(true);
        const extractedPalette = await extractPalette(url);
        setPalette(extractedPalette);
      } catch (err) {
        console.error('Palette extraction failed:', err);
      } finally {
        setExtracting(false);
      }
    }
  };

  const addGalleryItem = () => {
    setGalleryItems(prev => [...prev, { type: 'image', url: '', alt: '' }]);
  };

  const updateGalleryItem = (index: number, field: string, value: string) => {
    setGalleryItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeGalleryItem = (index: number) => {
    setGalleryItems(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!heroUrl) {
      setError('Hero media is required');
      return false;
    }

    if (heroType === 'image' && !heroAlt) {
      setError('Alt text is required for hero image');
      return false;
    }

    // Check gallery alt texts
    for (let i = 0; i < galleryItems.length; i++) {
      if (galleryItems[i].type === 'image' && galleryItems[i].url && !galleryItems[i].alt) {
        setError(`Alt text is required for gallery image ${i + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validate()) return;

    const mediaData: Partial<ProductDraft> = {
      heroMedia: {
        type: heroType,
        url: heroUrl,
        alt: heroAlt,
      },
      gallery: galleryItems.filter(item => item.url),
      palette,
    };

    onNext(mediaData);
  };

  return (
    <GlassPanel>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900">
            <ImageIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-stone-900 dark:text-stone-100">
              Add Media
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Upload hero image/video and gallery images
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Hero Media */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
              Hero Media * (required)
            </h3>

            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setHeroType('image')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  heroType === 'image'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100'
                    : 'border-stone-300 dark:border-stone-700'
                } transition-colors`}
              >
                <ImageIcon className="w-4 h-4" />
                Image
              </button>
              <button
                onClick={() => setHeroType('video')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                  heroType === 'video'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100'
                    : 'border-stone-300 dark:border-stone-700'
                } transition-colors`}
              >
                <Video className="w-4 h-4" />
                Video
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                {heroType === 'image' ? 'Image' : 'Video'} URL
              </label>
              <input
                type="url"
                value={heroUrl}
                onChange={(e) => handleHeroChange(e.target.value)}
                placeholder="https://example.com/images/hero.jpg"
                className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                {heroType === 'image' 
                  ? 'Recommended: 3200px width minimum for full-bleed display'
                  : 'MP4 or WebM format recommended, keep under 10MB'}
              </p>
            </div>

            {heroType === 'image' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Alt Text * (for accessibility)
                </label>
                <input
                  type="text"
                  value={heroAlt}
                  onChange={(e) => setHeroAlt(e.target.value)}
                  placeholder="Terra Travertine Side Table in natural honed finish"
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Hero Preview */}
            {heroUrl && (
              <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden bg-stone-50 dark:bg-stone-800">
                {heroType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroUrl} alt={heroAlt} className="w-full h-48 object-cover" />
                ) : (
                  <video src={heroUrl} className="w-full h-48 object-cover" controls />
                )}
              </div>
            )}
          </div>

          {/* Color Palette */}
          {palette && heroType === 'image' && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <PaletteIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h4 className="font-medium text-purple-900 dark:text-purple-100">
                  {extracting ? 'Extracting Palette...' : 'Extracted Color Palette'}
                </h4>
                {extracting && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
              </div>
              <div className="flex gap-3">
                {[palette.primary, palette.secondary, palette.accent].map((color, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-lg border-2 border-white dark:border-stone-900 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="text-xs">
                      <div className="font-medium text-purple-900 dark:text-purple-100">
                        {i === 0 ? 'Primary' : i === 1 ? 'Secondary' : 'Accent'}
                      </div>
                      <div className="text-purple-700 dark:text-purple-300 font-mono">
                        {color}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-3">
                This palette will be used for the cinematic page gradient
              </p>
            </div>
          )}

          {/* Gallery */}
          <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                Gallery (optional)
              </h3>
              <button
                onClick={addGalleryItem}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm"
              >
                <Upload className="w-4 h-4" />
                Add Image
              </button>
            </div>

            {galleryItems.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                <Upload className="w-12 h-12 mx-auto mb-3 text-stone-400" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  No gallery images yet. Click "Add Image" to start.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {galleryItems.map((item, index) => (
                  <div key={index} className="p-4 border border-stone-200 dark:border-stone-700 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        Gallery Image {index + 1}
                      </span>
                      <button
                        onClick={() => removeGalleryItem(index)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>

                    <input
                      type="url"
                      value={item.url}
                      onChange={(e) => updateGalleryItem(index, 'url', e.target.value)}
                      placeholder="https://example.com/images/gallery-1.jpg"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />

                    <input
                      type="text"
                      value={item.alt || ''}
                      onChange={(e) => updateGalleryItem(index, 'alt', e.target.value)}
                      placeholder="Alt text (required for images)"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />

                    {item.url && (
                      <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={item.alt} className="w-full h-32 object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={onBack}
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
          >
            ← Back
          </button>
          
          <Button onClick={handleNext} disabled={!heroUrl || extracting}>
            {extracting ? 'Extracting Palette...' : 'Next: Add Files'}
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}




