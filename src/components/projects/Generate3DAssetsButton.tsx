'use client';

// TODO: Gate 3D mesh generation behind premium designer tier once billing is wired.

import { useState } from 'react';
import { generate3DAssetsForProject } from '@/lib/client/generate3DAssets';

interface Generate3DAssetsButtonProps {
  projectId: string;
  onSuccess?: (result: { processedCount: number; success: number; failed: number }) => void;
  onError?: (error: string) => void;
}

export default function Generate3DAssetsButton({
  projectId,
  onSuccess,
  onError,
}: Generate3DAssetsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setStatus(null);

    try {
      const result = await generate3DAssetsForProject(projectId);

      if (result.error) {
        const errorMsg = result.error || 'Failed to generate 3D assets';
        setStatus(`Error: ${errorMsg}`);
        onError?.(errorMsg);
        return;
      }

      const successCount = result.stats?.succeeded || result.summary?.success || 0;
      const skippedCount = result.stats?.skipped || result.summary?.skipped || result.skippedCount || 0;
      const failedCount = result.stats?.failed || result.summary?.failed || 0;
      const processedCount = result.processedCount || 0;

      // Show toast-like summary message
      if (result.message) {
        setStatus(result.message);
      } else if (processedCount === 0 && skippedCount > 0) {
        setStatus(`All ${skippedCount} product${skippedCount !== 1 ? 's' : ''} already have 3D meshes. No new meshes generated.`);
      } else if (processedCount === 0) {
        setStatus('No eligible products found. Products must have an imageUrl and no existing threeDAssetUrl.');
      } else if (successCount > 0) {
        const parts = [`Generated 3D meshes for ${successCount} product${successCount !== 1 ? 's' : ''}`];
        if (skippedCount > 0) {
          parts.push(`${skippedCount} skipped`);
        }
        if (failedCount > 0) {
          parts.push(`${failedCount} failed`);
        }
        setStatus(parts.join(' (').concat(')'));
        onSuccess?.({
          processedCount,
          success: successCount,
          failed: failedCount,
        });
      } else {
        setStatus(`Failed to generate 3D meshes for all products.`);
        onError?.('All products failed to generate 3D meshes');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error occurred';
      setStatus(`Error: ${errorMsg}`);
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
        aria-label="Generate 3D Assets"
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span>
            <span className="hidden sm:inline">Generating...</span>
          </>
        ) : (
          <>
            <span>🎨</span>
            <span className="hidden sm:inline">Generate 3D Assets</span>
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

