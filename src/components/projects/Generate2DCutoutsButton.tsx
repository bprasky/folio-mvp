'use client';

import { useState } from 'react';
import { generate2dCutoutsForProject } from '@/lib/client/generate2dCutouts';
import { toast } from 'sonner';

interface Generate2DCutoutsButtonProps {
  projectId: string;
  onSuccess?: (result: { processedCount: number; success: number; failed: number }) => void;
  onError?: (error: string) => void;
}

export default function Generate2DCutoutsButton({
  projectId,
  onSuccess,
  onError,
}: Generate2DCutoutsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const result = await generate2dCutoutsForProject(projectId, { force: true });

      // Use new stats format if available, fallback to summary/legacy fields
      const stats = result.stats || {
        attempted: result.processedCount || 0,
        succeeded: result.summary?.success || 0,
        failed: result.summary?.failed || 0,
        skipped: result.summary?.skipped || result.skippedCount || 0,
      };

      const successCount = stats.succeeded;
      const skippedCount = stats.skipped;
      const failedCount = stats.failed;
      const attemptedCount = stats.attempted;

      // Handle different scenarios
      if (result.success === false || (attemptedCount > 0 && successCount === 0 && failedCount > 0)) {
        // All products failed, but API returned 200 (soft failure)
        const message = result.message || 'All products failed to generate 2D cutouts.';
        setStatus(message);
        toast.warning(message, {
          description: 'Check the server console (terminal) for detailed Roboflow error logs. Look for [2D CUTOUT] entries.',
          duration: 8000,
        });
        onError?.(message);
        // Still tell user to refresh - some might have succeeded in DB
        setTimeout(() => {
          toast.info('Refresh the page to see any cutouts that were successfully generated.');
        }, 2000);
      } else if (attemptedCount === 0 && skippedCount > 0) {
        const message = `All ${skippedCount} product${skippedCount !== 1 ? 's' : ''} already have 2D cutouts. No new cutouts generated.`;
        setStatus(message);
        toast.info(message);
      } else if (attemptedCount === 0) {
        const message = result.message || 'No eligible products found. Products must have an imageUrl and no existing cutoutImageUrl.';
        setStatus(message);
        toast.info(message);
      } else if (successCount > 0) {
        const parts = [`Generated 2D cutouts for ${successCount} product${successCount !== 1 ? 's' : ''}`];
        if (skippedCount > 0) {
          parts.push(`${skippedCount} skipped (already have cutout)`);
        }
        if (failedCount > 0) {
          parts.push(`${failedCount} failed`);
        }
        const message = result.message || parts.join(', ');
        setStatus(message);
        toast.success(message);
        onSuccess?.({
          processedCount: successCount + failedCount,
          success: successCount,
          failed: failedCount,
        });
        // Suggest refresh to see new cutouts
        setTimeout(() => {
          toast.info('Refresh the page to see the new cutouts in the Magazine.');
        }, 2000);
      } else {
        // Edge case: processed but no successes (should be caught above)
        const message = result.message || 'Unexpected result. Check server logs.';
        setStatus(message);
        toast.warning(message);
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error occurred';
      setStatus(`Error: ${errorMsg}`);
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition
          ${isLoading
            ? 'bg-white/10 cursor-not-allowed text-white/60'
            : 'bg-white/10 hover:bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40'
          }
        `}
        aria-label="Generate 2D Moodboard Assets"
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span>
            <span className="hidden sm:inline">Generating...</span>
          </>
        ) : (
          <>
            <span>✂️</span>
            <span className="hidden sm:inline">Generate 2D Moodboard Assets</span>
          </>
        )}
      </button>
      {status && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-surface-canvas rounded shadow-lg text-xs text-folio-text-primary max-w-xs z-50">
          {status}
        </div>
      )}
    </>
  );
}

