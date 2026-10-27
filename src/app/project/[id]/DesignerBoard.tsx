'use client';
import { createRoom as createRoomWithRetry } from '@/lib/client/createRoom';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import DesignerBoardRoom from './DesignerBoardRoom';
import { getRoomTemplate, RoomTemplate } from './roomTemplates';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { computeTileSize as dimensionComputeTileSize } from './tileSizing';
import { FaImage } from 'react-icons/fa';
import GenerateDialog from '@/components/boards/GenerateDialog';
import GeneratedGrid from '@/components/boards/GeneratedGrid';
import ExportSpecModal from './ExportSpecModal';
import { toast } from 'sonner';
import { BoardsEmptyState } from '@/components/designer/project';
import { useUserCapabilities } from '@/hooks/useUserCapabilities';
import { ProfessionalUpgradeModal } from '@/components/upgrade/ProfessionalUpgradeModal';

// Types based on the actual schema
type Selection = {
  id: string;
  photo?: string | null;
  vendorName?: string | null;
  productName?: string | null;
  colorFinish?: string | null;
  notes?: string | null;
  phaseOfUse?: string | null;
  gpsLocation?: string | null;
  source: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  roomId?: string | null;
  projectId: string;
  quantity?: number | null;
  specSheetFileName?: string | null;
  specSheetUrl?: string | null;
  unitPrice?: number | null;
  vendorProductId?: string | null;
  vendorRepId?: string | null;
  productUrl?: string | null;
  tags: string[];
  productTagId?: string | null;
  // TODO: Add metadata field for overrides when schema supports it
  metadata?: {
    displaySize?: 'auto' | 'large' | 'medium' | 'small';
    featured?: boolean;
  };
};

type ImageProductTag = {
  id: string;
  x: number;
  y: number;
  productId: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
  } | null;
};

type TaggedImage = {
  id: string;
  url: string;
  room?: string | null;
  tags: ImageProductTag[];
};

type Room = {
  id: string;
  name: string;
  type?: string | null; // Room type: KITCHEN, BATH, LIVING, BEDROOM, etc.
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  selections: Selection[];
  // TODO: Add paintColor field when schema supports it
  paintColor?: {
    name?: string;
    hex?: string;
  } | null;
};

type Project = {
  id: string;
  title: string;
  description?: string | null;
  rooms: Room[];
};

type DesignerBoardProps = {
  projectId: string;
  project: Project;
  showAll?: boolean; // default true
  imageCount?: number;
  images?: TaggedImage[]; // project images with ProductTag data
};

// Reuse the Festival sizing logic
type Size = 'L' | 'M' | 'S';

function computeTileSize(sel: Selection): Size {
  // Use the new dimension-driven sizing logic
  return dimensionComputeTileSize(sel);
}


export default function DesignerBoard({
  projectId,
  project,
  showAll = true,
  imageCount = 0,
  images = [],
}: DesignerBoardProps) {
  const router = useRouter();
  const capabilities = useUserCapabilities();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [paintAccentEnabled, setPaintAccentEnabled] = useState<Record<string, boolean>>({});
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string;
    url: string;
    width: number;
    height: number;
    name?: string;
    createdAt?: string;
    metadata?: any;
  }>>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Pricing data for status indicators on board tiles
  const [pricingData, setPricingData] = useState<Record<string, { status: string; unitPriceTrade: number | null; leadTimeWeeks: number | null; availability: string | null }>>({});

  useEffect(() => {
    fetch(`/api/projects/${projectId}/pricing`)
      .then(res => res.ok ? res.json() : { entries: [] })
      .then(data => {
        const map: typeof pricingData = {};
        for (const entry of data.entries || []) {
          map[entry.productId] = {
            status: entry.status,
            unitPriceTrade: entry.unitPriceTrade,
            leadTimeWeeks: entry.leadTimeWeeks,
            availability: entry.availability,
          };
        }
        setPricingData(map);
      })
      .catch(() => {});
  }, [projectId]);

  const refreshPricing = () => {
    fetch(`/api/projects/${projectId}/pricing`)
      .then(res => res.ok ? res.json() : { entries: [] })
      .then(data => {
        const map: typeof pricingData = {};
        for (const entry of data.entries || []) {
          map[entry.productId] = {
            status: entry.status,
            unitPriceTrade: entry.unitPriceTrade,
            leadTimeWeeks: entry.leadTimeWeeks,
            availability: entry.availability,
          };
        }
        setPricingData(map);
      })
      .catch(() => {});
  };

  // Filter rooms based on selection
  const filteredRooms = useMemo(() => {
    if (!selectedRoomId) return project.rooms;
    return project.rooms.filter(room => room.id === selectedRoomId);
  }, [project.rooms, selectedRoomId]);

  // Compute orphaned ProductTags — tags not linked to any Selection
  const orphanedTags = useMemo(() => {
    if (!images || images.length === 0) return [];

    // Collect all productTagIds linked from selections
    const linkedTagIds = new Set<string>();
    for (const room of project.rooms) {
      for (const sel of room.selections) {
        if (sel.productTagId) {
          linkedTagIds.add(sel.productTagId);
        }
      }
    }

    // Find tags that aren't linked
    const orphaned: Array<ImageProductTag & { image: TaggedImage }> = [];
    for (const img of images) {
      for (const tag of img.tags) {
        if (!linkedTagIds.has(tag.id)) {
          orphaned.push({ ...tag, image: img });
        }
      }
    }
    return orphaned;
  }, [images, project.rooms]);

  const handleRoomPaintAccentToggle = (roomId: string) => {
    setPaintAccentEnabled(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const handleCreateRoom = useCallback(async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);

    try {
      await createRoomWithRetry({ projectId: projectId, name: 'New Room' });

      toast.success('Room created');
      router.refresh();
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('Failed to create room');
    } finally {
      setIsCreatingRoom(false);
    }
  }, [projectId, router, isCreatingRoom]);

  const handleSelectionSizeOverride = (selectionId: string, newSize: Size | 'auto') => {
    // TODO: Implement persistence when schema supports metadata field
    console.log('Size override:', { selectionId, newSize });
    // For now, this will be handled by local state in DesignerBoardRoom
  };

  // Load generated images for the current room
  const loadGeneratedImages = async () => {
    if (!selectedRoomId) return;
    
    setLoadingImages(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/rooms/${selectedRoomId}/generated-images`);
      if (response.ok) {
        const data = await response.json();
        // Handle the new API response format: { ok: true, assets: [...] }
        const images = data.assets || data || [];
        setGeneratedImages(Array.isArray(images) ? images : []);
      }
    } catch (error) {
      console.error('Failed to load generated images:', error);
      setGeneratedImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleGenerateImages = () => {
    // Check if user can generate images (requires professional tier)
    if (!capabilities.canGenerateImages) {
      setUpgradeModalOpen(true);
      return;
    }
    setGenerateDialogOpen(true);
  };

  const handleGenerationComplete = (assets: Array<{ id: string; url: string; width: number; height: number }>) => {
    // Add new generated images to the list
    setGeneratedImages(prev => [...prev, ...assets]);
    setGenerateDialogOpen(false);
    // Optionally refresh the images list
    loadGeneratedImages();
  };

  const handleRefreshImages = () => {
    loadGeneratedImages();
  };

  // Load images when selectedRoomId changes
  useMemo(() => {
    loadGeneratedImages();
  }, [selectedRoomId]);

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleExport = async (scope: 'current' | 'all', format: 'xlsx' | 'pdf', roomId?: string) => {
    try {
      const params = new URLSearchParams({
        scope,
        format,
      });
      if (roomId) {
        params.set('roomId', roomId);
      }

      const response = await fetch(`/api/projects/${projectId}/export-spec?${params.toString()}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `folio-spec-${projectId}-${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toast
      toast.success('Export ready');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export spec');
      throw error;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Room filter pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          aria-pressed={selectedRoomId === null}
          onClick={() => setSelectedRoomId(null)}
          className={clsx(
            'px-3.5 py-1.5 rounded-full text-sm transition-colors duration-[220ms]',
            selectedRoomId === null
              ? 'bg-folio-text-primary text-white border border-folio-text-primary'
              : 'bg-surface-canvas text-folio-text-secondary border border-folio-border-subtle hover:border-folio-border-strong hover:text-folio-text-primary',
          )}
        >
          All rooms{' '}
          <span className="opacity-60 ml-1.5 tabular-nums">{project.rooms.length}</span>
        </button>
        {project.rooms.map(room => (
          <button
            key={room.id}
            aria-pressed={selectedRoomId === room.id}
            onClick={() => setSelectedRoomId(room.id)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-sm transition-colors duration-[220ms]',
              selectedRoomId === room.id
                ? 'bg-folio-text-primary text-white border border-folio-text-primary'
                : 'bg-surface-canvas text-folio-text-secondary border border-folio-border-subtle hover:border-folio-border-strong hover:text-folio-text-primary',
            )}
          >
            {formatRoomName(room.name)}{' '}
            <span className="opacity-60 ml-1.5 tabular-nums">{room.selections.length}</span>
          </button>
        ))}

        <div className="flex-1" />

        <span className="text-sm text-folio-text-tertiary mr-1">
          {filteredRooms.reduce((sum, room) => sum + room.selections.length, 0)}{' '}
          {filteredRooms.reduce((sum, room) => sum + room.selections.length, 0) === 1
            ? 'item'
            : 'items'}
        </span>

        <button
          onClick={() => setExportModalOpen(true)}
          className="px-3.5 py-1.5 rounded-full text-sm border border-folio-border-subtle text-folio-text-secondary transition-colors duration-[220ms] hover:border-folio-border-strong hover:text-folio-text-primary"
        >
          Export spec
        </button>

        {selectedRoomId && (
          <button
            onClick={handleGenerateImages}
            className="px-3.5 py-1.5 rounded-full text-sm border border-folio-border-subtle text-folio-text-secondary transition-colors duration-[220ms] hover:border-folio-border-strong hover:text-folio-text-primary inline-flex items-center gap-2"
          >
            <FaImage className="w-3.5 h-3.5" />
            Generate images
          </button>
        )}
      </div>

      {/* Room Groups */}
      <div className="space-y-12">
        {filteredRooms.map(room => (
          <DesignerBoardRoom
            key={room.id}
            room={room}
            projectId={projectId}
            showAll={showAll}
            paintAccentEnabled={paintAccentEnabled[room.id] || false}
            onPaintAccentToggle={() => handleRoomPaintAccentToggle(room.id)}
            onSelectionSizeOverride={handleSelectionSizeOverride}
            pricingData={pricingData}
            onPricingRefresh={refreshPricing}
          />
        ))}
      </div>

      {filteredRooms.length === 0 && project.rooms.length === 0 && imageCount > 0 && (
        <div className="max-w-md mx-auto py-16 text-center">
          <h3 className="folio-ui font-semibold text-folio-text-primary mb-2">
            Organize your photos by room
          </h3>
          <p className="folio-body text-folio-text-secondary mb-6">
            Name each room and choose the photos that belong to it.
          </p>
          <Link
            href={`/project/${encodeURIComponent(projectId)}?view=media&step=rooms&action=sort-rooms`}
            className="ridge-btn px-4 py-2"
          >
            Organize rooms
          </Link>
        </div>
      )}

      {filteredRooms.length === 0 && project.rooms.length === 0 && imageCount === 0 && (
        <BoardsEmptyState
          projectId={projectId}
          projectName={project.title}
          onCreateRoom={handleCreateRoom}
        />
      )}

      {filteredRooms.length === 0 && project.rooms.length > 0 && (
        <div className="text-center py-12 text-folio-text-secondary">
          <p className="folio-body">No rooms match your filter</p>
          <p className="folio-ui mt-2">Try selecting a different room or "All Rooms"</p>
        </div>
      )}

      {/* Orphaned ProductTags — tags not linked to any Selection */}
      {orphanedTags.length > 0 && (
        <div className="space-y-4">
          <h3 className="folio-ui font-semibold text-folio-text-primary">
            Tagged Products
            <span className="ml-2 folio-meta font-normal text-folio-text-secondary">
              {orphanedTags.length} product{orphanedTags.length !== 1 ? 's' : ''} not yet in a room
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {orphanedTags.map((tag) => {
              const xPct = tag.x <= 1 ? tag.x * 100 : tag.x;
              const yPct = tag.y <= 1 ? tag.y * 100 : tag.y;
              return (
                <div
                  key={tag.id}
                  className="ridge-card overflow-hidden"
                >
                  {/* Image thumbnail with tag dot */}
                  <div className="relative aspect-[4/3] bg-surface-ground">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tag.image.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div
                      className="absolute z-10"
                      style={{
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-lg" />
                    </div>
                  </div>
                  {/* Product info */}
                  <div className="px-3 py-2">
                    <p className="folio-meta font-medium text-folio-text-primary truncate">
                      {tag.product?.name ?? 'Unknown Product'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated Images Section */}
      {selectedRoomId && (
        <div className="mt-8 pt-8 border-t border-folio-border-subtle">
          <GeneratedGrid
            projectId={projectId}
            roomId={selectedRoomId}
            images={generatedImages}
            onRefresh={handleRefreshImages}
          />
        </div>
      )}

      {/* Generate Dialog */}
      {selectedRoomId && (
        <GenerateDialog
          projectId={projectId}
          roomId={selectedRoomId}
          roomName={formatRoomName(project.rooms.find(r => r.id === selectedRoomId)?.name || 'Room')}
          selections={project.rooms.find(r => r.id === selectedRoomId)?.selections || []}
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          onDone={handleGenerationComplete}
        />
      )}

      {/* Export Spec Modal */}
      <ExportSpecModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        projectId={projectId}
        currentRoomId={selectedRoomId}
        onExport={handleExport}
      />

      {/* Professional Upgrade Modal */}
      <ProfessionalUpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        orgId={capabilities.orgId}
        orgName={capabilities.orgName}
        orgStatus={capabilities.orgStatus}
        featureRequested="image_generation"
      />
    </div>
  );
}
