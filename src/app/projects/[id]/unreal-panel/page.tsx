'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaDownload, FaBook, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { RidgeCard } from '@/components/ui/ridge-card';
import ThreeDAssetList, { ThreeDAsset } from '@/components/ThreeD/ThreeDAssetList';
import UnrealExportModal from '@/components/ThreeD/UnrealExportModal';

interface Project {
  id: string;
  title: string;
}

export default function UnrealExportPanel() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ThreeDAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportData, setExportData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Resolve params and load project and assets
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // Load project
        const projectRes = await fetch(`/api/projects/${projectId}`);
        if (!projectRes.ok) {
          if (projectRes.status === 404) {
            setError('Project not found');
            setIsLoading(false);
            return;
          }
          throw new Error('Failed to load project');
        }
        const projectData = await projectRes.json();
        setProject({
          id: projectData.id,
          title: projectData.title || 'Untitled Project',
        });

        // Load 3D assets
        const assetsRes = await fetch(
          `/api/3d-assets?projectId=${projectId}`
        );
        if (!assetsRes.ok) {
          throw new Error('Failed to load 3D assets');
        }
        const assetsData = await assetsRes.json();
        setAssets(assetsData);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    // Poll for status updates if any assets are processing
    const interval = setInterval(() => {
      const hasProcessing = assets.some(
        (asset) => asset.status === 'PROCESSING' || asset.status === 'PENDING'
      );
      if (hasProcessing) {
        fetch(`/api/3d-assets?projectId=${projectId}`)
          .then((res) => res.json())
          .then((data) => setAssets(data))
          .catch((err) => console.error('Error polling assets:', err));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId, assets]);

  const handleToggleExport = async (assetId: string, currentValue: boolean) => {
    // Optimistic update
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId
          ? { ...asset, includeInUnrealExport: !currentValue }
          : asset
      )
    );

    try {
      const res = await fetch(`/api/3d-assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeInUnrealExport: !currentValue,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update export setting');
      }

      const updatedAsset = await res.json();
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === assetId ? updatedAsset : asset
        )
      );
    } catch (err: any) {
      console.error('Error toggling export:', err);
      // Revert optimistic update
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === assetId
            ? { ...asset, includeInUnrealExport: currentValue }
            : asset
        )
      );
      alert(err.message || 'Failed to update export setting');
    }
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/unreal-export`
      );
      if (!res.ok) {
        throw new Error('Failed to export JSON');
      }
      const data = await res.json();
      setExportData(data);
      setExportModalOpen(true);
    } catch (err: any) {
      console.error('Error exporting JSON:', err);
      alert(err.message || 'Failed to export JSON');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="w-8 h-8 text-folio-text-tertiary animate-spin mx-auto mb-4" />
          <p className="folio-body text-folio-text-secondary">Loading Unreal Export Panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <RidgeCard className="max-w-md p-6">
          <h2 className="folio-h3 flex items-center gap-2 text-red-600 mb-4">
            <FaExclamationTriangle className="w-5 h-5" />
            Error
          </h2>
          <p className="folio-body text-folio-text-secondary mb-4">{error}</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </RidgeCard>
      </div>
    );
  }

  const readyAssetsCount = assets.filter((a) => a.status === 'READY').length;
  const includedAssetsCount = assets.filter(
    (a) => a.status === 'READY' && a.includeInUnrealExport
  ).length;

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header */}
      <div className="bg-surface-ground border-b border-folio-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="text-folio-text-secondary hover:text-folio-text-primary transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="folio-h1">
                  Unreal Export Panel
                </h1>
                <p className="folio-meta text-folio-text-secondary mt-1">
                  {project?.title || 'Untitled Project'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/unreal/docs">
                <Button variant="outline" className="flex items-center gap-2">
                  <FaBook className="w-4 h-4" />
                  Open in Unreal Docs
                </Button>
              </Link>
              <Button
                onClick={handleExportJSON}
                disabled={isExporting || includedAssetsCount === 0}
                variant="accent"
                className="flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <FaSpinner className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FaDownload className="w-4 h-4" />
                    Download Unreal Export JSON
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Card */}
        <RidgeCard className="mb-6 p-6">
          <h2 className="folio-h2 mb-2">Export Summary</h2>
          <p className="folio-meta text-folio-text-secondary mb-6">
            Overview of 3D assets ready for Unreal Engine export
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-canvas rounded-lg p-4 border border-folio-border-subtle">
              <div className="folio-h2 text-[var(--accent)]">
                {assets.length}
              </div>
              <div className="folio-meta text-folio-text-secondary mt-1">
                Total 3D Assets
              </div>
            </div>
            <div className="bg-surface-canvas rounded-lg p-4 border border-folio-border-subtle">
              <div className="folio-h2 text-[var(--accent)]">
                {readyAssetsCount}
              </div>
              <div className="folio-meta text-folio-text-secondary mt-1">
                Ready for Export
              </div>
            </div>
            <div className="bg-surface-canvas rounded-lg p-4 border border-folio-border-subtle">
              <div className="folio-h2 text-[var(--accent)]">
                {includedAssetsCount}
              </div>
              <div className="folio-meta text-folio-text-secondary mt-1">
                Included in Export
              </div>
            </div>
          </div>
        </RidgeCard>

        {/* Assets List */}
        <RidgeCard className="p-6">
          <h2 className="folio-h2 mb-2">3D Assets</h2>
          <p className="folio-meta text-folio-text-secondary mb-6">
            Manage which assets are included in the Unreal Engine export
          </p>
          <ThreeDAssetList
            assets={assets}
            onToggleExport={handleToggleExport}
            isLoading={false}
          />
        </RidgeCard>
      </div>

      {/* Export Modal */}
      {exportModalOpen && exportData && project && (
        <UnrealExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          exportData={exportData}
          projectTitle={project.title}
        />
      )}
    </div>
  );
}
