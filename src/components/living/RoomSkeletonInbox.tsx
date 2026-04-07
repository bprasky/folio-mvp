'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface SkeletonItem {
  id: string;
  projectImageId: string;
  roomName?: string | null;
  label: string;
  confidence: number;
}

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
}

interface RoomSkeletonInboxProps {
  projectId: string;
  roomId: string | null; // null means "all rooms" or "unassigned"
  roomName: string; // Display name
  projectImages: ProjectImage[]; // Images for this room/context
  onSkeletonClick: (skeletonId: string, imageId: string) => void;
  enabled: boolean;
}

export default function RoomSkeletonInbox({
  projectId,
  roomId,
  roomName,
  projectImages,
  onSkeletonClick,
  enabled,
}: RoomSkeletonInboxProps) {
  const [skeletons, setSkeletons] = useState<SkeletonItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId) {
      setSkeletons([]);
      return;
    }

    async function fetchSkeletons() {
      setLoading(true);
      try {
        // Fetch all skeletons for the project
        const response = await fetch(`/api/living/skeleton?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          const items = data.items || data.skeletonItems || [];
          
          // Filter by room and UNCONFIRMED status
          let filtered = items.filter((s: any) => s.status === 'UNCONFIRMED');
          
          // Filter by room if roomId is specified
          if (roomId === null) {
            // Show unassigned (null roomName)
            filtered = filtered.filter((s: SkeletonItem) => !s.roomName);
          } else {
            // Filter by matching room name
            const imagesInRoom = new Set(projectImages.map(img => img.id));
            filtered = filtered.filter((s: SkeletonItem) => {
              // Match by room name or by image belonging to room
              return imagesInRoom.has(s.projectImageId);
            });
          }
          
          setSkeletons(filtered);
        }
      } catch (error) {
        console.error('[RoomSkeletonInbox] Failed to fetch skeletons:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSkeletons();
  }, [projectId, roomId, projectImages, enabled]);

  if (!enabled) return null;

  const imageMap = new Map(projectImages.map(img => [img.id, img]));

  return (
    <div className="bg-surface-canvas border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-folio-text-primary">Unfinished details</h3>
        {loading && <span className="text-sm text-folio-text-secondary">Loading...</span>}
      </div>

      {skeletons.length === 0 ? (
        <p className="text-sm text-folio-text-secondary text-center py-4">
          No unconfirmed details in this room
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {skeletons.map((skeleton) => {
            const image = imageMap.get(skeleton.projectImageId);
            
            return (
              <button
                key={skeleton.id}
                onClick={() => onSkeletonClick(skeleton.id, skeleton.projectImageId)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-ground transition-colors text-left"
              >
                {image && (
                  <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-surface-ground">
                    <Image
                      src={image.url}
                      alt={image.name || 'Project image'}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-folio-text-primary truncate">
                    Unconfirmed detail
                  </div>
                  <div className="text-xs text-folio-text-secondary">
                    {(skeleton.confidence * 100).toFixed(0)}% confidence
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}








