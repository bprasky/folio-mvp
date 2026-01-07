'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaDownload, FaBook, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Unreal Export Panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <FaExclamationTriangle className="w-5 h-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{error}</p>
            <Button onClick={() => router.back()} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const readyAssetsCount = assets.filter((a) => a.status === 'READY').length;
  const includedAssetsCount = assets.filter(
    (a) => a.status === 'READY' && a.includeInUnrealExport
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <FaArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Unreal Export Panel
                </h1>
                <p className="text-gray-600 mt-1">
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Export Summary</CardTitle>
            <CardDescription>
              Overview of 3D assets ready for Unreal Engine export
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-900">
                  {assets.length}
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  Total 3D Assets
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-900">
                  {readyAssetsCount}
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Ready for Export
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-900">
                  {includedAssetsCount}
                </div>
                <div className="text-sm text-purple-700 mt-1">
                  Included in Export
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assets List */}
        <Card>
          <CardHeader>
            <CardTitle>3D Assets</CardTitle>
            <CardDescription>
              Manage which assets are included in the Unreal Engine export
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThreeDAssetList
              assets={assets}
              onToggleExport={handleToggleExport}
              isLoading={false}
            />
          </CardContent>
        </Card>
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




