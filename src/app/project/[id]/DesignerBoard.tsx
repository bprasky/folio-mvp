'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import DesignerBoardRoom from './DesignerBoardRoom';
import { getRoomTemplate, RoomTemplate } from './roomTemplates';
import { computeTileSize as dimensionComputeTileSize } from './tileSizing';
import { Button } from '@/components/ui/button';
import { FaImage, FaSpinner } from 'react-icons/fa';
import GenerateDialog from '@/components/boards/GenerateDialog';
import GeneratedGrid from '@/components/boards/GeneratedGrid';
import ExportSpecModal from './ExportSpecModal';
import { toast } from 'sonner';

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
  // TODO: Add metadata field for overrides when schema supports it
  metadata?: {
    displaySize?: 'auto' | 'large' | 'medium' | 'small';
    featured?: boolean;
  };
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
  showAll = true 
}: DesignerBoardProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [paintAccentEnabled, setPaintAccentEnabled] = useState<Record<string, boolean>>({});
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
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

  // Filter rooms based on selection
  const filteredRooms = useMemo(() => {
    if (!selectedRoomId) return project.rooms;
    return project.rooms.filter(room => room.id === selectedRoomId);
  }, [project.rooms, selectedRoomId]);

  const handleRoomPaintAccentToggle = (roomId: string) => {
    setPaintAccentEnabled(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

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
      {/* Controls Bar with Glassmorphism */}
      <div className="rounded-2xl border border-white/10 bg-white/6 backdrop-blur-md shadow-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label htmlFor="room-filter" className="text-sm font-medium text-gray-700">
            Filter by room:
          </label>
          <select
            id="room-filter"
            value={selectedRoomId || ''}
            onChange={(e) => setSelectedRoomId(e.target.value || null)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Rooms</option>
            {project.rooms.map(room => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} • {filteredRooms.reduce((sum, room) => sum + room.selections.length, 0)} items
          </div>
          
          {/* Export Spec Button */}
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-2xl border border-white/10 bg-white/6 backdrop-blur-md shadow-lg hover:bg-white/10 transition-colors"
          >
            Export Spec
          </button>
          
          {/* Generate Images Button */}
          {selectedRoomId && (
            <Button
              onClick={handleGenerateImages}
              className="inline-flex items-center gap-2"
            >
              <FaImage className="w-4 h-4" />
              Generate Images
            </Button>
          )}
        </div>
      </div>

      {/* Room Groups */}
      <div className="space-y-8">
        {filteredRooms.map(room => (
          <DesignerBoardRoom
            key={room.id}
            room={room}
            projectId={projectId}
            showAll={showAll}
            paintAccentEnabled={paintAccentEnabled[room.id] || false}
            onPaintAccentToggle={() => handleRoomPaintAccentToggle(room.id)}
            onSelectionSizeOverride={handleSelectionSizeOverride}
          />
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No rooms found</p>
          <p className="text-sm mt-2">Create rooms and add selections to see them here</p>
        </div>
      )}

      {/* Generated Images Section */}
      {selectedRoomId && (
        <div className="mt-8 pt-8 border-t border-gray-200">
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
          roomName={project.rooms.find(r => r.id === selectedRoomId)?.name || 'Room'}
          selectionsCount={project.rooms.find(r => r.id === selectedRoomId)?.selections.length || 0}
          selectionsPreview={project.rooms.find(r => r.id === selectedRoomId)?.selections.slice(0, 6).map(s => ({
            name: s.productName || 'Untitled Product',
            category: s.tags.find(tag => 
              ['sofas', 'chairs', 'tables', 'lighting', 'rugs', 'art', 'storage', 'countertops', 'appliances', 'faucets', 'sinks'].includes(tag.toLowerCase())
            )
          })) || []}
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
    </div>
  );
}
