/**
 * Export button that triggers carousel generation and download
 */

'use client';

import { useState } from 'react';
import { FaDownload, FaSpinner } from 'react-icons/fa';

interface ExportButtonProps {
  projectId: string;
  orderedImageIds: string[];
  selectedQuotes: string[];
  onExportComplete?: () => void;
}

export default function ExportButton({
  projectId,
  orderedImageIds,
  selectedQuotes,
  onExportComplete,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/instagram/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          orderedImageIds,
          selectedQuotes,
        }),
      });

      if (!response.ok) {
        // Try to parse error as JSON, but handle HTML error pages
        let errorMessage = `HTTP ${response.status}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await response.text();
            console.warn('[ExportButton] Server returned HTML instead of JSON:', text.substring(0, 200));
            errorMessage = `Server error (${response.status}) - check server logs`;
          }
        } catch (parseError) {
          errorMessage = `Failed to parse error response: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Parse response as JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError: any) {
        const text = await response.text();
        console.error('[ExportButton] Response is not JSON:', text.substring(0, 200));
        throw new Error('Invalid response format (expected JSON)');
      }

      // Safety check: ensure zip data exists
      if (!data.zip || typeof data.zip !== 'string') {
        throw new Error('Missing ZIP data in response');
      }

      // Convert base64 to blob and download
      try {
        const binaryString = atob(data.zip);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'instagram-export.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (blobError: any) {
        console.error('[ExportButton] Failed to create blob:', blobError);
        throw new Error(`Failed to create download file: ${blobError.message}`);
      }

      onExportComplete?.();
    } catch (err: any) {
      console.error('[ExportButton] Error:', err);
      setError(err.message || 'Failed to export carousel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleExport}
        disabled={isExporting || orderedImageIds.length === 0}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        title="Generate and download all carousel slides as a ZIP file"
      >
        {isExporting ? (
          <>
            <FaSpinner className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FaDownload />
            Download ZIP
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}

