'use client';

import { useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ProductDraft } from '@/types/vendor-product';
import { ScrapeResult, Confidence } from '@/types/scrape';
import { mergeDraftWithScrape } from '@/lib/vendor/mergeDraftWithScrape';
import { MapPin, Package, Tag, Sparkles, RefreshCw } from 'lucide-react';

interface StepMapProps {
  initialData: Partial<ProductDraft>;
  scrapedData?: ScrapeResult;
  onNext: (data: Partial<ProductDraft>) => void;
  onBack: () => void;
}

function ConfidenceBadge({ confidence, source }: { confidence?: Confidence; source?: string }) {
  if (confidence === undefined) return null;
  
  const colors = {
    2: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    1: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    0: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  };
  
  const labels = {
    2: 'High',
    1: 'Medium',
    0: 'Low',
  };
  
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className={`text-xs px-2 py-0.5 rounded border ${colors[confidence]}`}>
        {labels[confidence]} Confidence
      </span>
      {source && confidence >= 1 && (
        <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" />
          from {source}
        </span>
      )}
    </div>
  );
}

export function StepMap({ initialData, scrapedData, onNext, onBack }: StepMapProps) {
  const touched = useRef<Set<string>>(new Set());
  
  const methods = useForm<Partial<ProductDraft>>({
    defaultValues: initialData,
    shouldUnregister: false,
  });
  
  const { register, handleSubmit, reset, formState: { errors }, setError } = methods;

  // 🔑 Auto-fill from scraped data on mount
  useEffect(() => {
    if (scrapedData && scrapedData.success) {
      const merged = mergeDraftWithScrape(initialData, scrapedData, touched.current);
      // RHF needs reset() to hydrate inputs after mount
      reset(merged, { keepDirty: true, keepTouched: true });
    }
  }, [scrapedData, initialData, reset]);

  // Track touched fields
  const registerTouched = (name: string) => ({
    ...register(name as any),
    onChange: (e: any) => {
      touched.current.add(name);
      register(name as any).onChange(e);
    },
  });

  const applyAllHighConfidence = () => {
    if (!scrapedData) return;
    
    // Apply all high-confidence fields, ignoring touched set
    const merged = mergeDraftWithScrape(initialData, scrapedData, new Set());
    reset(merged);
  };

  const validate = (data: Partial<ProductDraft>) => {
    let isValid = true;

    if (!data.name || data.name.trim().length < 3) {
      setError('name', { message: 'Product name must be at least 3 characters' });
      isValid = false;
    }

    if (!data.sku || data.sku.trim().length < 2) {
      setError('sku', { message: 'SKU is required' });
      isValid = false;
    }

    if (!data.description || data.description.trim().length < 40) {
      setError('description', { message: 'Description must be at least 40 characters' });
      isValid = false;
    }

    if (!data.materials?.length && !data.finish) {
      setError('materials', { message: 'At least materials or finish is required' });
      isValid = false;
    }

    return isValid;
  };

  const onSubmit = (data: Partial<ProductDraft>) => {
    if (!validate(data)) return;
    
    // Process materials and tags from comma-separated strings if needed
    const processed = {
      ...data,
      materials: typeof data.materials === 'string' 
        ? (data.materials as string).split(',').map(m => m.trim()).filter(Boolean)
        : data.materials,
      tags: typeof data.tags === 'string'
        ? (data.tags as string).split(',').map(t => t.trim()).filter(Boolean)
        : data.tags,
    };
    
    onNext(processed);
  };

  // Get confidence for a field
  const getFieldConfidence = (path: string): { confidence?: Confidence; source?: string } => {
    if (!scrapedData || !scrapedData.success) return {};
    
    const pathMap: Record<string, any> = {
      'name': scrapedData.identity.name,
      'sku': scrapedData.identity.sku,
      'description': scrapedData.description,
      'price': scrapedData.commerce.msrp,
      'materials': scrapedData.specs.materials,
      'finish': scrapedData.specs.finish,
      'leadTime': scrapedData.specs.leadTime,
      'category': scrapedData.specs.rooms,
    };
    
    const field = pathMap[path];
    return field ? { confidence: field.confidence, source: field.source } : {};
  };

  return (
    <FormProvider {...methods}>
      <GlassPanel>
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900">
                <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-medium text-stone-900 dark:text-stone-100">
                  Map Product Fields
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Review and edit the extracted information
                </p>
              </div>
            </div>
            
            {scrapedData && scrapedData.success && (
              <Button 
                onClick={applyAllHighConfidence}
                variant="outline"
                className="flex items-center gap-2"
                type="button"
              >
                <Sparkles className="w-4 h-4" />
                Apply All High-Confidence
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Product Name *
                    </label>
                    <input
                      {...registerTouched('name')}
                      placeholder="Terra Travertine Side Table"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        errors.name
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-stone-300 dark:border-stone-700 focus:ring-blue-500'
                      } bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:border-transparent`}
                    />
                    <ConfidenceBadge {...getFieldConfidence('name')} />
                    {errors.name && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      SKU *
                    </label>
                    <input
                      {...registerTouched('sku')}
                      placeholder="FS-TERRA-20"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        errors.sku
                          ? 'border-red-500'
                          : 'border-stone-300 dark:border-stone-700'
                      } bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                    <ConfidenceBadge {...getFieldConfidence('sku')} />
                    {errors.sku && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.sku.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Price (optional)
                    </label>
                    <input
                      type="number"
                      {...registerTouched('price')}
                      placeholder="1250"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <ConfidenceBadge {...getFieldConfidence('price')} />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Description * (min 40 characters)
                    </label>
                    <textarea
                      {...registerTouched('description')}
                      placeholder="A monolithic side table in honed travertine with soft radius edge..."
                      rows={4}
                      className={`w-full px-4 py-2 rounded-lg border ${
                        errors.description
                          ? 'border-red-500'
                          : 'border-stone-300 dark:border-stone-700'
                      } bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
                    />
                    <ConfidenceBadge {...getFieldConfidence('description')} />
                    {errors.description && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.description.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-700">
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                  Specifications
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Materials (comma-separated)
                    </label>
                    <input
                      {...registerTouched('materials')}
                      placeholder="Travertine, Stone"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <ConfidenceBadge {...getFieldConfidence('materials')} />
                    {errors.materials && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.materials.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Finish
                    </label>
                    <input
                      {...registerTouched('finish')}
                      placeholder="Honed Natural"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <ConfidenceBadge {...getFieldConfidence('finish')} />
                  </div>

                  {/* Dimensions */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Dimensions (W × D × H)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="number"
                        {...registerTouched('dimensions.w')}
                        placeholder="Width"
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        {...registerTouched('dimensions.d')}
                        placeholder="Depth"
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        {...registerTouched('dimensions.h')}
                        placeholder="Height"
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        {...registerTouched('dimensions.units')}
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="in">in</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Weight (optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        {...registerTouched('weight.value')}
                        placeholder="25"
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        {...registerTouched('weight.units')}
                        className="px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Lead Time (optional)
                    </label>
                    <input
                      {...registerTouched('leadTime')}
                      placeholder="6–8 weeks"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <ConfidenceBadge {...getFieldConfidence('leadTime')} />
                  </div>
                </div>
              </div>

              {/* Categorization */}
              <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-stone-700">
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Categorization
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Category
                    </label>
                    <input
                      {...registerTouched('category')}
                      placeholder="Furniture, Lighting, Textiles..."
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <ConfidenceBadge {...getFieldConfidence('category')} />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      {...registerTouched('tags')}
                      placeholder="modern, stone, side-table, luxury"
                      className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={onBack}
                className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                ← Back
              </button>
              
              <Button type="submit" size="lg">
                Next: Add Media →
              </Button>
            </div>
          </form>
        </div>
      </GlassPanel>
    </FormProvider>
  );
}
