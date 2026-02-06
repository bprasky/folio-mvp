'use client';

import { useState, useRef } from 'react';
import { FaFileAlt, FaClock, FaForward, FaSpinner, FaCheckCircle } from 'react-icons/fa';

interface FinishScheduleOptionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onComplete: (option: 'uploaded' | 'later' | 'skip') => void;
}

export function FinishScheduleOptionsModal({
  open,
  onOpenChange,
  projectId,
  onComplete,
}: FinishScheduleOptionsModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint', // ppt
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv',
    ];

    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, PowerPoint, Excel, or CSV file');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setError(null);
    setUploadProgress(10);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('sourceType', 'PRESENTATION');

      setUploadProgress(30);

      // Upload and process the file
      const response = await fetch('/api/import/finish-schedule', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(60);
      setUploadStatus('processing');

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to process finish schedule');
      }

      setUploadProgress(100);
      setUploadStatus('complete');

      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      onComplete('uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadLater = () => {
    onComplete('later');
  };

  const handleSkip = () => {
    onComplete('skip');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isUploading && onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">Before Your Interview</h2>
          <p className="text-white/90 text-sm mt-1">
            Optionally upload your finish schedule to help generate richer editorial content
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {uploadStatus === 'idle' && (
            <div className="space-y-4">
              {/* Upload Option */}
              <button
                onClick={handleUploadClick}
                className="w-full p-4 border-2 border-dashed border-[var(--accent)]/30 rounded-xl hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[var(--accent)]/10 rounded-lg group-hover:bg-[var(--accent)]/20 transition-colors">
                    <FaFileAlt className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Upload Finish Schedule</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      PDF, PowerPoint, Excel, or CSV with your product specifications
                    </p>
                    <p className="text-xs text-[var(--accent)] mt-2">
                      AI will match products to your uploaded images
                    </p>
                  </div>
                </div>
              </button>

              {/* Upload Later Option */}
              <button
                onClick={handleUploadLater}
                className="w-full p-4 border border-[var(--ridge-outer)] rounded-xl hover:border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-lg group-hover:bg-[var(--bg-elevated)] transition-colors">
                    <FaClock className="w-6 h-6 text-[var(--text-secondary)]" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Upload Later</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Continue with the interview now, add finish schedule anytime
                    </p>
                  </div>
                </div>
              </button>

              {/* Skip Option */}
              <button
                onClick={handleSkip}
                className="w-full p-4 border border-[var(--ridge-outer)] rounded-xl hover:border-[var(--ridge-outer)] hover:bg-[var(--bg-elevated)] transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-lg group-hover:bg-[var(--bg-elevated)] transition-colors">
                    <FaForward className="w-6 h-6 text-[var(--text-secondary)]" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)]">Skip - Manual Tagging</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Tag products manually in each image
                    </p>
                  </div>
                </div>
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="py-8 text-center">
              <FaSpinner className="w-12 h-12 text-[var(--accent)] animate-spin mx-auto mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                {uploadStatus === 'uploading' ? 'Uploading...' : 'Processing finish schedule...'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                {uploadStatus === 'processing'
                  ? 'AI is matching products to your images'
                  : 'Please wait while we upload your file'}
              </p>
              <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
                <div
                  className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadStatus === 'complete' && (
            <div className="py-8 text-center">
              <FaCheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">Processing Complete!</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Products have been matched and tagged. Proceeding to interview...
              </p>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="py-8 text-center">
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-4">
                {error || 'An error occurred while processing your file'}
              </div>
              <button
                onClick={() => {
                  setUploadStatus('idle');
                  setError(null);
                }}
                className="px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.pptx,.ppt,.xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Footer */}
        {uploadStatus === 'idle' && (
          <div className="px-6 pb-6">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
