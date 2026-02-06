'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ProductDraft } from '@/types/vendor-product';
import { ScrapeResult } from '@/types/scrape';
import { ArrowLeft, Check } from 'lucide-react';

// Step components
import { StepUrl } from './StepUrl';
import { StepScrape } from './StepScrape';
import { StepMap } from './StepMap';
import { StepMedia } from './StepMedia';
import { StepFiles } from './StepFiles';
import { StepReview } from './StepReview';

type WizardStep = 'url' | 'scrape' | 'map' | 'media' | 'files' | 'review';

interface ProductWizardProps {
  vendorId: string;
}

export function ProductWizard({ vendorId }: ProductWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('url');
  const [scrapedData, setScrapedData] = useState<ScrapeResult | undefined>(undefined);
  const [productData, setProductData] = useState<Partial<ProductDraft>>({
    vendorId,
    materials: [],
    tags: [],
    gallery: [],
    files: {
      specSheets: [],
      _3d: [],
      others: [],
    },
    status: 'draft',
  });

  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: 'url', label: 'URL' },
    { id: 'scrape', label: 'Scrape' },
    { id: 'map', label: 'Map Fields' },
    { id: 'media', label: 'Media' },
    { id: 'files', label: 'Files' },
    { id: 'review', label: 'Review' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    } else {
      router.push('/vendor/dashboard');
    }
  };

  const updateProductData = (data: Partial<ProductDraft>) => {
    setProductData(prev => ({ ...prev, ...data }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        
        <h1 className="text-3xl font-serif font-light text-stone-900 dark:text-stone-100 mb-2">
          Add New Product
        </h1>
        <p className="text-stone-600 dark:text-stone-400">
          Scrape product details from a URL or enter manually
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      index < currentStepIndex
                        ? 'bg-green-500 text-white'
                        : index === currentStepIndex
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className={`mt-2 text-xs text-center ${
                    index === currentStepIndex
                      ? 'text-[var(--accent)] dark:text-blue-400 font-medium'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}>
                    {step.label}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      index < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-stone-200 dark:bg-stone-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 'url' && (
            <StepUrl
              onNext={(url: string) => {
                updateProductData({ sourceUrl: url });
                goToStep('scrape');
              }}
              onSkip={() => goToStep('map')}
            />
          )}

          {currentStep === 'scrape' && (
            <StepScrape
              url={productData.sourceUrl || ''}
              onComplete={(data: ScrapeResult) => {
                setScrapedData(data);
                goToStep('map');
              }}
              onBack={() => goToStep('url')}
            />
          )}

          {currentStep === 'map' && (
            <StepMap
              initialData={productData}
              scrapedData={scrapedData}
              onNext={(mappedData: Partial<ProductDraft>) => {
                updateProductData(mappedData);
                goToStep('media');
              }}
              onBack={() => goToStep('url')}
            />
          )}

          {currentStep === 'media' && (
            <StepMedia
              initialData={productData}
              onNext={(mediaData: Partial<ProductDraft>) => {
                updateProductData(mediaData);
                goToStep('files');
              }}
              onBack={() => goToStep('map')}
            />
          )}

          {currentStep === 'files' && (
            <StepFiles
              initialData={productData}
              onNext={(filesData: Partial<ProductDraft>) => {
                updateProductData(filesData);
                goToStep('review');
              }}
              onBack={() => goToStep('media')}
            />
          )}

          {currentStep === 'review' && (
            <StepReview
              productData={productData as ProductDraft}
              onPublish={(slug: string) => {
                router.push(`/products/${slug}`);
              }}
              onBack={() => goToStep('files')}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

