'use client';

import { useState, useEffect } from 'react';
import { FaInstagram, FaTimes, FaDownload, FaSpinner } from 'react-icons/fa';

interface CampaignWizardProps {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}

type CampaignPreset = 'compact' | 'standard' | 'complete';

interface ContentSelection {
  preset: CampaignPreset;
  totalPosts: number;
  rooms: Array<{
    name: string;
    imageCount: number;
    suggested: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    brand: string;
    suggested: boolean;
  }>;
  quotes: Array<{
    text: string;
    suggested: boolean;
  }>;
  details: Array<{
    caption: string;
  }>;
}

export function CampaignWizard({ projectId, projectTitle, onClose }: CampaignWizardProps) {
  const [preset, setPreset] = useState<CampaignPreset>('standard');
  const [contentSelection, setContentSelection] = useState<ContentSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load content selection when preset changes
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/instagram/campaign/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, preset }),
        });

        if (!response.ok) {
          throw new Error('Failed to load campaign preview');
        }

        const data = await response.json();
        setContentSelection(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [projectId, preset]);

  const handleGenerate = async () => {
    if (!contentSelection) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/instagram/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          preset,
          formats: ['square', 'portrait', 'story'],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate campaign');
      }

      // Download ZIP file
      const base64Data = await response.text();
      const blob = new Blob(
        [Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))],
        { type: 'application/zip' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-instagram-campaign.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close modal after successful download
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const selectedRooms = contentSelection?.rooms.filter((r) => r.suggested).length || 0;
  const selectedProducts = contentSelection?.products.filter((p) => p.suggested).length || 0;
  const selectedQuotes = contentSelection?.quotes.filter((q) => q.suggested).length || 0;
  const totalPosts = contentSelection?.totalPosts || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Generate Instagram Campaign
            </h2>
            <p className="mt-1 text-sm text-gray-600">{projectTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preset Selection */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Campaign Size</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPreset('compact')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'compact'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold text-gray-900">Compact</div>
                <div className="mt-1 text-sm text-gray-600">4-6 posts</div>
              </button>
              <button
                onClick={() => setPreset('standard')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'standard'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold text-gray-900">Standard</div>
                <div className="mt-1 text-sm text-gray-600">8-12 posts</div>
              </button>
              <button
                onClick={() => setPreset('complete')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'complete'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold text-gray-900">Complete</div>
                <div className="mt-1 text-sm text-gray-600">15-20+ posts</div>
              </button>
            </div>
          </div>

          {/* Content Preview */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="animate-spin text-gray-400" size={32} />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {contentSelection && !loading && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">What's Included</h3>
                  <span className="text-2xl font-bold text-[var(--accent)]">{totalPosts} posts</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">✓ Launch Card</span>
                    <span className="text-gray-500">1</span>
                  </div>

                  {selectedRooms > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">✓ Room Spotlights</span>
                      <span className="text-gray-500">{selectedRooms}</span>
                    </div>
                  )}

                  {selectedProducts > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">✓ Product Features</span>
                      <span className="text-gray-500">{selectedProducts}</span>
                    </div>
                  )}

                  {selectedQuotes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">✓ Story Cards</span>
                      <span className="text-gray-500">{selectedQuotes}</span>
                    </div>
                  )}

                  {contentSelection.details.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">✓ Detail Moments</span>
                      <span className="text-gray-500">{contentSelection.details.length}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">✓ Closer</span>
                    <span className="text-gray-500">1</span>
                  </div>
                </div>
              </div>

              {/* Formats */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-2 text-sm font-medium text-gray-900">Formats</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>✓ Feed (1080×1080, 1080×1350)</div>
                  <div>✓ Stories (1080×1920)</div>
                </div>
              </div>

              {/* Suggested Pacing */}
              <div className="rounded-lg bg-[var(--accent)]/5 p-4 text-sm">
                <div className="font-medium text-blue-900">
                  Suggested pacing: 2 posts/week ≈ {Math.ceil(totalPosts / 2)} weeks
                </div>
                <div className="mt-1 text-[var(--accent-hover)]">
                  Mix with other projects for feed variety.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!contentSelection || generating}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <>
                <FaSpinner className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FaDownload />
                Generate & Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
