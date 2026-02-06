'use client';

import { useState, useCallback, useRef } from 'react';
import { GlassModal, GlassModalHeader, GlassModalBody } from '@/components/ui/glass-modal';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ImportProgress } from './ImportProgress';
import { VerificationQueue } from './VerificationQueue';

type ImportStep = 'source' | 'upload' | 'processing' | 'review';
type SourceType = 'PRESENTATION' | 'WEBSITE' | 'BULK_IMAGES';

interface ImportSession {
  id: string;
  status: string;
  totalImages: number;
  totalProducts: number;
  verifiedTags: number;
}

interface PendingTag {
  id: string;
  tempImageUrl: string | null;
  projectImageId: string | null;
  x: number;
  y: number;
  description: string;
  category: string;
  searchQuery: string;
  suggestions: Array<{
    productUrl: string;
    vendorName: string;
    productName: string;
    price?: string;
    confidence: string;
    matchReason: string;
  }>;
  topSuggestion: {
    productUrl: string;
    vendorName: string;
    productName: string;
    price?: string;
    confidence: string;
    matchReason: string;
  } | null;
  detectionConfidence: string;
  attributionConfidence: string | null;
  status: string;
}

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onComplete?: (sessionId: string) => void;
}

export function ImportWizard({ open, onOpenChange, projectId, onComplete }: ImportWizardProps) {
  const [step, setStep] = useState<ImportStep>('source');
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [pendingTags, setPendingTags] = useState<PendingTag[]>([]);
  const [total, setTotal] = useState(0);
  const [confidenceBreakdown, setConfidenceBreakdown] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = useCallback(() => {
    setStep('source');
    setSourceType(null);
    setSession(null);
    setPendingTags([]);
    setTotal(0);
    setConfidenceBreakdown({});
    setError(null);
    setUploadProgress(0);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(resetWizard, 300);
  }, [onOpenChange, resetWizard]);

  const createSession = useCallback(async (type: SourceType) => {
    try {
      const response = await fetch('/api/import/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: type, projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create import session');
      }

      const data = await response.json();
      return data.sessionId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      return null;
    }
  }, [projectId]);

  const handleSourceSelect = useCallback(async (type: SourceType) => {
    setSourceType(type);
    setStep('upload');
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Create session first
      const sessionId = await createSession(sourceType!);
      if (!sessionId) return;

      // For now, simulate processing - in production, this would upload the file
      // and trigger the import agent processing
      setStep('processing');
      setUploadProgress(10);

      // Simulate processing steps
      for (let i = 20; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setUploadProgress(i);
      }

      // Fetch session status
      const sessionResponse = await fetch(`/api/import/${sessionId}`);
      if (!sessionResponse.ok) {
        throw new Error('Failed to get session status');
      }

      const sessionData = await sessionResponse.json();
      setSession(sessionData);

      // Fetch pending tags
      const tagsResponse = await fetch(`/api/import/${sessionId}/pending-tags`);
      if (!tagsResponse.ok) {
        throw new Error('Failed to get pending tags');
      }

      const tagsData = await tagsResponse.json();
      setPendingTags(tagsData.pendingTags);
      setTotal(tagsData.total);
      setConfidenceBreakdown(tagsData.confidenceBreakdown);

      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStep('upload');
    } finally {
      setIsUploading(false);
    }
  }, [sourceType, createSession]);

  const refreshPendingTags = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/import/${session.id}/pending-tags`);
      if (!response.ok) {
        throw new Error('Failed to refresh pending tags');
      }

      const data = await response.json();
      setPendingTags(data.pendingTags);
      setTotal(data.total);
      setConfidenceBreakdown(data.confidenceBreakdown);
    } catch (err) {
      console.error('Failed to refresh:', err);
    }
  }, [session]);

  const handleComplete = useCallback(async () => {
    if (!session) return;

    try {
      await fetch(`/api/import/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      onComplete?.(session.id);
      handleClose();
    } catch (err) {
      console.error('Failed to complete:', err);
    }
  }, [session, onComplete, handleClose]);

  return (
    <GlassModal open={open} onOpenChange={handleClose} size="xl">
      <GlassModalHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif text-stone-900">Import Project</h2>
          <button
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ImportProgress step={step} className="mt-4" />
      </GlassModalHeader>

      <GlassModalBody>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 'source' && (
          <div className="space-y-4">
            <p className="text-stone-600 mb-6">
              Choose how you&apos;d like to import your project. Our AI will analyze your content
              and detect products for tagging.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SourceCard
                title="Presentation"
                description="Upload a PDF or PPTX presentation"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                onClick={() => handleSourceSelect('PRESENTATION')}
              />

              <SourceCard
                title="Website"
                description="Import from your portfolio website"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                }
                onClick={() => handleSourceSelect('WEBSITE')}
                disabled
                comingSoon
              />

              <SourceCard
                title="Bulk Images"
                description="Upload a folder of project images"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                onClick={() => handleSourceSelect('BULK_IMAGES')}
                disabled
                comingSoon
              />
            </div>
          </div>
        )}

        {step === 'upload' && sourceType === 'PRESENTATION' && (
          <div className="space-y-6">
            <p className="text-stone-600">
              Upload your presentation file. We support PDF and PPTX formats.
            </p>

            <div
              className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <svg
                className="w-12 h-12 mx-auto text-stone-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-stone-600 mb-2">
                <span className="text-[var(--accent)] font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-sm text-stone-400">PDF or PPTX up to 50MB</p>
            </div>

            <Button variant="outline" onClick={() => setStep('source')}>
              Back
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-6 text-center py-8">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 rounded-full border-4 border-stone-200" />
              <div
                className="absolute inset-0 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin"
                style={{
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">
                Analyzing your presentation...
              </h3>
              <p className="text-stone-500">
                Our AI is detecting products and searching for attributions.
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-stone-400 mt-2">{uploadProgress}% complete</p>
            </div>
          </div>
        )}

        {step === 'review' && session && (
          <VerificationQueue
            sessionId={session.id}
            pendingTags={pendingTags}
            total={total}
            confidenceBreakdown={confidenceBreakdown}
            onRefresh={refreshPendingTags}
            onComplete={handleComplete}
          />
        )}
      </GlassModalBody>
    </GlassModal>
  );
}

// Source selection card
function SourceCard({
  title,
  description,
  icon,
  onClick,
  disabled,
  comingSoon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative p-6 rounded-xl border text-left transition-all
        ${disabled
          ? 'border-stone-200 bg-stone-50 cursor-not-allowed opacity-60'
          : 'border-stone-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer'
        }
      `}
    >
      {comingSoon && (
        <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-stone-100 text-stone-500 rounded-full">
          Coming soon
        </span>
      )}
      <div className="text-stone-400 mb-4">{icon}</div>
      <h3 className="font-medium text-stone-900 mb-1">{title}</h3>
      <p className="text-sm text-stone-500">{description}</p>
    </button>
  );
}
