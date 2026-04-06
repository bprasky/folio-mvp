'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import {
  FaDownload,
  FaTrash,
  FaEye,
  FaImage,
  FaStar,
  FaRegStar,
  FaInfoCircle,
  FaSpinner,
  FaFolderPlus
} from 'react-icons/fa';
import SaveImageToProjectModal from './SaveImageToProjectModal';

interface GeneratedImage {
  id: string;
  url: string;
  width: number;
  height: number;
  name?: string;
  createdAt?: string;
  provider?: string;
  metadata?: {
    type: 'GENERATED';
    provider: string;
    promptBase: string;
    promptModifiers: string;
    promptFull: string;
    selectionIds: string[];
    context: any;
    generatedBy: string;
    generatedAt: string;
  };
}

interface GeneratedGridProps {
  projectId: string;
  roomId: string;
  images: GeneratedImage[];
  onRefresh?: () => void;
}

export default function GeneratedGrid({ 
  projectId, 
  roomId, 
  images, 
  onRefresh 
}: GeneratedGridProps) {
  // Safety check: ensure images is always an array
  const safeImages = Array.isArray(images) ? images : [];
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [saveToProjectImage, setSaveToProjectImage] = useState<GeneratedImage | null>(null);

  if (safeImages.length === 0) {
    return (
      <div className="text-center py-8 text-folio-text-secondary">
        <FaImage className="w-12 h-12 mx-auto mb-4 text-folio-text-tertiary" />
        <p className="text-lg font-medium mb-2">No generated images yet</p>
        <p className="text-sm">Generate images using the "Generate Images" button above</p>
      </div>
    );
  }

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image');
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this generated image?')) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(imageId));

    try {
      const response = await fetch(`/api/projects/${projectId}/images/${imageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      toast.success('Image deleted');
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete image');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  };

  const handleSetAsCover = async (image: GeneratedImage) => {
    try {
      // This would call an API to set the image as the room/project cover
      // For now, just show a toast
      toast.success('Set as cover (feature coming soon)');
    } catch (error) {
      console.error('Set cover failed:', error);
      toast.error('Failed to set as cover');
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'stability': return '🎨';
      case 'fake': return '🎭';
      default: return '🔮';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-folio-text-primary">
          Generated Images ({safeImages.length})
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {safeImages.map((image) => (
          <div
            key={image.id}
            className="group relative rounded-lg border border-folio-border-subtle overflow-hidden bg-white hover:shadow-md transition-shadow"
          >
            {/* Image */}
            <div className="aspect-square relative">
              <img
                src={image.url}
                alt="Generated image"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedImage(image)}
                      className="bg-white/90 hover:bg-white"
                      title="View details"
                    >
                      <FaEye className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSaveToProjectImage(image)}
                      className="bg-white/90 hover:bg-white"
                      title="Save to another project"
                    >
                      <FaFolderPlus className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(image)}
                      className="bg-white/90 hover:bg-white"
                      title="Download"
                    >
                      <FaDownload className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDelete(image.id)}
                      disabled={deletingIds.has(image.id)}
                      className="bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      {deletingIds.has(image.id) ? (
                        <FaSpinner className="w-3 h-3 animate-spin" />
                      ) : (
                        <FaTrash className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Provider Badge */}
              {image.metadata && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-xs bg-white/90">
                    <span className="mr-1">
                      {getProviderIcon(image.metadata.provider)}
                    </span>
                    Generated
                  </Badge>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-folio-text-secondary">
                  {image.width} × {image.height}
                  {image.provider && (
                    <span className="ml-2 text-folio-text-tertiary">
                      • {image.provider === 'openai' ? 'OpenAI' : image.provider === 'stability' ? 'Stability' : image.provider}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSetAsCover(image)}
                  className="h-6 w-6 p-0 text-folio-text-tertiary hover:text-yellow-500"
                >
                  <FaStar className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FaImage className="w-5 h-5" />
              Generated Image Details
            </DialogTitle>
          </DialogHeader>

          {selectedImage && (
            <div className="space-y-4">
              {/* Image */}
              <div className="relative">
                <img
                  src={selectedImage.url}
                  alt="Generated image"
                  className="w-full max-h-96 object-contain rounded-lg border"
                />
              </div>

              {/* Metadata */}
              {selectedImage.metadata && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Prompt */}
                  <div>
                    <h4 className="font-medium text-folio-text-primary mb-2">Full Prompt</h4>
                    <p className="text-sm text-folio-text-secondary bg-surface-ground p-3 rounded-lg">
                      {selectedImage.metadata.promptFull}
                    </p>
                  </div>

                  {/* Context */}
                  <div>
                    <h4 className="font-medium text-folio-text-primary mb-2">Generation Context</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Provider:</span> {selectedImage.metadata.provider}
                      </div>
                      <div>
                        <span className="font-medium">Generated:</span> {new Date(selectedImage.metadata.generatedAt).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Based on:</span> {selectedImage.metadata.selectionIds.length} selections
                      </div>
                      <div>
                        <span className="font-medium">Room:</span>{" "}
                        {selectedImage?.metadata?.context?.roomName ?? "(untitled room)"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedImage(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => handleDownload(selectedImage)}
                >
                  <FaDownload className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <a
                  href={selectedImage?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-muted-foreground hover:text-foreground transition-colors"
                >
                  Open image
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save to Project Modal */}
      <SaveImageToProjectModal
        isOpen={!!saveToProjectImage}
        onClose={() => setSaveToProjectImage(null)}
        sourceProjectId={projectId}
        imageId={saveToProjectImage?.id ?? ''}
        imageUrl={saveToProjectImage?.url ?? ''}
        onSuccess={() => {
          setSaveToProjectImage(null);
        }}
      />
    </div>
  );
}
