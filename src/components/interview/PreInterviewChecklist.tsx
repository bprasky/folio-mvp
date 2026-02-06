'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';

interface ChecklistStatus {
  images: {
    total: number;
    analyzed: number;
  };
  tags: number;
  selections: number;
  canAutoTag: boolean;
}

interface PreInterviewChecklistProps {
  projectId: string;
  onStartInterview: () => void;
  onCancel: () => void;
}

/**
 * PreInterviewChecklist
 *
 * Shows a checklist of preparation steps before starting the interview.
 * Allows auto-tagging products from design boards if available.
 */
export function PreInterviewChecklist({
  projectId,
  onStartInterview,
  onCancel,
}: PreInterviewChecklistProps) {
  const [status, setStatus] = useState<ChecklistStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch checklist status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/auto-tag`);
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch checklist status:', err);
      setError('Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle auto-tag
  const handleAutoTag = async () => {
    setIsAutoTagging(true);
    setAutoTagResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/auto-tag`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Auto-tag failed');
      }

      const data = await res.json();
      setAutoTagResult(data.message);

      // Refresh status after auto-tagging
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Auto-tag failed');
    } finally {
      setIsAutoTagging(false);
    }
  };

  // Checklist items
  const hasPhotos = (status?.images.total ?? 0) > 0;
  const hasAnalysis = (status?.images.analyzed ?? 0) > 0;
  const hasTags = (status?.tags ?? 0) > 0;
  const canAutoTag = status?.canAutoTag && (status?.selections ?? 0) > 0;

  return (
    <div className="bg-[var(--bg-base)] rounded-2xl shadow-xl border border-[var(--ridge-outer)] w-full max-h-[90vh] overflow-y-auto max-w-md">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h2 className="font-semibold text-[var(--text-primary)] text-xl">
          Preparing Your Interview
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          A few things help us craft the best questions for your project.
        </p>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-[var(--text-tertiary)] animate-spin" />
          </div>
        ) : error && !status ? (
          <div className="text-red-600 text-sm py-4">{error}</div>
        ) : (
          <>
            {/* Checklist Items */}
            <div className="space-y-3 mb-5">
              {/* Photos uploaded */}
              <ChecklistItem
                completed={hasPhotos}
                title="Photos uploaded"
                subtitle={
                  hasPhotos
                    ? `${status?.images.total} photo${status?.images.total !== 1 ? 's' : ''} in your project`
                    : 'Upload photos to get started'
                }
              />

              {/* Photos analyzed */}
              <ChecklistItem
                completed={hasAnalysis}
                title="Photos analyzed"
                subtitle={
                  hasAnalysis
                    ? `${status?.images.analyzed} of ${status?.images.total} analyzed for colors, materials & style`
                    : 'Photos will be analyzed automatically'
                }
              />

              {/* Products tagged */}
              <ChecklistItem
                completed={hasTags}
                title="Products tagged"
                subtitle={
                  hasTags
                    ? `${status?.tags} product${status?.tags !== 1 ? 's' : ''} tagged on your photos`
                    : canAutoTag
                    ? `${status?.selections} products in your design boards ready to tag`
                    : 'Add products to your design board, then tag them on photos'
                }
              />
            </div>

            {/* Auto-tag prompt */}
            {canAutoTag && !hasTags && (
              <div className="mb-5 p-3 bg-[var(--accent)]/10 rounded-lg border border-[var(--accent)]/20">
                <p className="text-sm text-[var(--text-primary)] mb-2">
                  You have {status?.selections} products in your design boards.
                </p>
                <button
                  onClick={handleAutoTag}
                  disabled={isAutoTagging}
                  className="w-full py-2 px-4 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAutoTagging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Auto-tagging...
                    </>
                  ) : (
                    'Auto-tag from Design Boards'
                  )}
                </button>
              </div>
            )}

            {/* Auto-tag result */}
            {autoTagResult && (
              <div className="mb-5 p-3 bg-green-50 rounded-lg border border-green-200 text-green-700 text-sm">
                {autoTagResult}
              </div>
            )}

            {/* Error message */}
            {error && status && (
              <div className="mb-5 p-3 bg-red-50 rounded-lg border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onStartInterview}
                className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150"
                style={{
                  background: 'var(--accent, #B8845C)',
                  boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.1))',
                }}
              >
                Start Interview
              </button>
              <button
                onClick={onCancel}
                className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] transition-all duration-150"
              >
                Not yet
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({
  completed,
  title,
  subtitle,
}: {
  completed: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          completed
            ? 'bg-[var(--accent)]'
            : 'border-2 border-[var(--ridge-outer)]'
        }`}
      >
        {completed && (
          <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
