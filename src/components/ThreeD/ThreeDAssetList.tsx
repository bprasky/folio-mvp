'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FaCube, FaSpinner, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ThreeDPreview from './ThreeDPreview';

export interface ThreeDAsset {
  id: string;
  projectImageId: string | null;
  productId: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  glbUrl: string | null;
  thumbnailUrl: string | null;
  includeInUnrealExport: boolean;
  meta?: any;
  projectImage?: {
    id: string;
    url: string;
    name?: string | null;
  } | null;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
  } | null;
}

interface ThreeDAssetListProps {
  assets: ThreeDAsset[];
  onToggleExport: (assetId: string, currentValue: boolean) => Promise<void>;
  isLoading?: boolean;
}

export default function ThreeDAssetList({
  assets,
  onToggleExport,
  isLoading = false,
}: ThreeDAssetListProps) {
  const [previewAsset, setPreviewAsset] = useState<ThreeDAsset | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleToggle = async (assetId: string, currentValue: boolean) => {
    if (togglingIds.has(assetId)) return;
    
    setTogglingIds((prev) => new Set(prev).add(assetId));
    try {
      await onToggleExport(assetId, currentValue);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const getStatusBadge = (status: ThreeDAsset['status']) => {
    switch (status) {
      case 'READY':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <FaCube className="w-3 h-3 mr-1" />
            Ready
          </Badge>
        );
      case 'PROCESSING':
      case 'PENDING':
        return (
          <Badge variant="default" className="bg-[var(--accent)]/10 text-blue-800">
            <FaSpinner className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <FaExclamationTriangle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  const getThumbnailUrl = (asset: ThreeDAsset): string | null => {
    if (asset.thumbnailUrl) return asset.thumbnailUrl;
    if (asset.projectImage?.url) return asset.projectImage.url;
    if (asset.product?.imageUrl) return asset.product.imageUrl;
    return null;
  };

  const getAssetName = (asset: ThreeDAsset): string => {
    if (asset.projectImage?.name) return asset.projectImage.name;
    if (asset.product?.name) return asset.product.name;
    return 'Untitled Asset';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FaSpinner className="w-8 h-8 text-folio-text-tertiary animate-spin" />
        <span className="ml-3 text-folio-text-secondary">Loading 3D assets...</span>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 bg-surface-ground rounded-lg border-2 border-dashed border-folio-border-subtle">
        <FaCube className="w-16 h-16 mx-auto mb-4 text-folio-text-tertiary" />
        <h3 className="text-lg font-semibold text-folio-text-primary mb-2">
          No 3D assets yet
        </h3>
        <p className="text-folio-text-secondary max-w-md mx-auto">
          Generate 3D models from your project images in the Media section.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {assets.map((asset) => {
          const thumbnailUrl = getThumbnailUrl(asset);
          const assetName = getAssetName(asset);
          const isToggling = togglingIds.has(asset.id);

          return (
            <div
              key={asset.id}
              className="bg-surface-canvas rounded-lg border border-folio-border-subtle p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                {thumbnailUrl ? (
                  <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-surface-ground">
                    <Image
                      src={thumbnailUrl}
                      alt={assetName}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-surface-ground flex items-center justify-center">
                    <FaCube className="w-8 h-8 text-folio-text-tertiary" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-folio-text-primary truncate">
                        {assetName}
                      </h3>
                      {asset.projectImage && (
                        <p className="text-sm text-folio-text-secondary mt-1">
                          From project image
                        </p>
                      )}
                      {asset.product && (
                        <p className="text-sm text-folio-text-secondary mt-1">
                          Product: {asset.product.name}
                        </p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {getStatusBadge(asset.status)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4">
                    {/* Include in Unreal Export Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={asset.includeInUnrealExport}
                        onChange={() =>
                          handleToggle(asset.id, asset.includeInUnrealExport)
                        }
                        disabled={isToggling || asset.status !== 'READY'}
                        className="w-4 h-4 text-[var(--accent)] rounded focus:ring-[var(--accent)] disabled:opacity-50"
                      />
                      <span className="text-sm text-folio-text-primary">
                        Include in Unreal Export
                      </span>
                      {isToggling && (
                        <FaSpinner className="w-3 h-3 text-folio-text-tertiary animate-spin" />
                      )}
                    </label>

                    {/* View 3D Button */}
                    {asset.status === 'READY' && asset.glbUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewAsset(asset)}
                        className="flex items-center gap-2"
                      >
                        <FaEye className="w-3 h-3" />
                        View 3D
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3D Preview Modal */}
      {previewAsset && previewAsset.glbUrl && (
        <ThreeDPreview
          glbUrl={previewAsset.glbUrl}
          onClose={() => setPreviewAsset(null)}
        />
      )}
    </>
  );
}




