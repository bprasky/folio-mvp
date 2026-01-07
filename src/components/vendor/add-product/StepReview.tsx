'use client';

import { useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ProductDraft } from '@/types/vendor-product';
import { validateProduct } from '@/lib/vendor/validateProduct';
import { publishProduct } from '@/app/vendor/products/actions';
import { CheckCircle, AlertCircle, Loader2, Eye } from 'lucide-react';

interface StepReviewProps {
  productData: ProductDraft;
  onPublish: (slug: string) => void;
  onBack: () => void;
}

export function StepReview({ productData, onPublish, onBack }: StepReviewProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Validate on load
  const validation = validateProduct(productData);

  const handlePublish = async () => {
    if (!validation.isValid) {
      return;
    }

    setIsPublishing(true);
    setPublishError('');

    try {
      const result = await publishProduct(productData);

      if (result.success && result.slug) {
        // Redirect to cinematic product page
        onPublish(result.slug);
      } else {
        setPublishError(result.error || 'Failed to publish product');
      }
    } catch (error: any) {
      setPublishError(error.message || 'An unexpected error occurred');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <GlassPanel>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-medium text-stone-900 dark:text-stone-100">
              Review & Publish
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Review your product before publishing
            </p>
          </div>
        </div>

        {/* Validation Status */}
        <div className={`mb-6 p-4 rounded-xl border ${
          validation.isValid
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {validation.isValid ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Ready to Publish
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    All required fields are complete and valid
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Validation Errors
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1 list-disc list-inside">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {publishError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-900 dark:text-red-100">{publishError}</p>
          </div>
        )}

        {/* Product Summary */}
        <div className="space-y-6">
          {/* Basic Info */}
          <ReviewSection title="Basic Information">
            <ReviewItem label="Name" value={productData.name} />
            <ReviewItem label="SKU" value={productData.sku} />
            <ReviewItem label="Description" value={productData.description} truncate />
            {productData.price && (
              <ReviewItem label="Price" value={`$${productData.price}`} />
            )}
          </ReviewSection>

          {/* Specifications */}
          <ReviewSection title="Specifications">
            {productData.materials && productData.materials.length > 0 && (
              <ReviewItem label="Materials" value={productData.materials.join(', ')} />
            )}
            {productData.finish && (
              <ReviewItem label="Finish" value={productData.finish} />
            )}
            {productData.dimensions && (
              <ReviewItem 
                label="Dimensions" 
                value={`${productData.dimensions.w}" × ${productData.dimensions.d}" × ${productData.dimensions.h}" ${productData.dimensions.units}`} 
              />
            )}
            {productData.weight && (
              <ReviewItem 
                label="Weight" 
                value={`${productData.weight.value} ${productData.weight.units}`} 
              />
            )}
            {productData.leadTime && (
              <ReviewItem label="Lead Time" value={productData.leadTime} />
            )}
          </ReviewSection>

          {/* Media */}
          <ReviewSection title="Media">
            <div>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                Hero {productData.heroMedia?.type === 'video' ? 'Video' : 'Image'}
              </p>
              <div className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden bg-stone-50 dark:bg-stone-800">
                {productData.heroMedia?.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={productData.heroMedia.url} 
                    alt={productData.heroMedia.alt} 
                    className="w-full h-48 object-cover" 
                  />
                ) : productData.heroMedia?.type === 'video' ? (
                  <video 
                    src={productData.heroMedia.url} 
                    className="w-full h-48 object-cover" 
                    controls 
                  />
                ) : null}
              </div>
            </div>

            {productData.gallery && productData.gallery.length > 0 && (
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Gallery ({productData.gallery.length} {productData.gallery.length === 1 ? 'image' : 'images'})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {productData.gallery.slice(0, 6).map((item, index) => (
                    <div 
                      key={index} 
                      className="rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden aspect-square"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={item.url} 
                        alt={item.alt} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {productData.palette && (
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                  Color Palette
                </p>
                <div className="flex gap-2">
                  {[productData.palette.primary, productData.palette.secondary, productData.palette.accent].map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg border border-stone-300 dark:border-stone-600"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-stone-600 dark:text-stone-400 font-mono">
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ReviewSection>

          {/* Files */}
          {(productData.files?.specSheets.length > 0 || productData.files?._3d.length > 0 || productData.files?.others && productData.files.others.length > 0) && (
            <ReviewSection title="Files">
              {productData.files.specSheets.length > 0 && (
                <ReviewItem 
                  label="Spec Sheets" 
                  value={`${productData.files.specSheets.length} file(s)`} 
                />
              )}
              {productData.files._3d.length > 0 && (
                <ReviewItem 
                  label="3D Models" 
                  value={`${productData.files._3d.length} file(s)`} 
                />
              )}
              {productData.files.others && productData.files.others.length > 0 && (
                <ReviewItem 
                  label="Additional Files" 
                  value={`${productData.files.others.length} file(s)`} 
                />
              )}
            </ReviewSection>
          )}

          {/* Categorization */}
          <ReviewSection title="Categorization">
            {productData.category && (
              <ReviewItem label="Category" value={productData.category} />
            )}
            {productData.tags && productData.tags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {productData.tags.map((tag, index) => (
                    <span 
                      key={index} 
                      className="px-2 py-1 text-xs rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </ReviewSection>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={onBack}
            disabled={isPublishing}
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
          
          <Button 
            onClick={handlePublish} 
            disabled={!validation.isValid || isPublishing}
            className="min-w-[140px]"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              'Publish Product'
            )}
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border border-stone-200 dark:border-stone-700 rounded-xl space-y-3">
      <h3 className="font-medium text-stone-900 dark:text-stone-100">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function ReviewItem({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</p>
      <p className={`text-sm text-stone-600 dark:text-stone-400 mt-1 ${truncate ? 'line-clamp-2' : ''}`}>
        {value}
      </p>
    </div>
  );
}




