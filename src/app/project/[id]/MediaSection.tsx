'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUpload, FaImages, FaTag, FaCheckCircle, FaCloudUploadAlt, FaFileImport, FaTrash } from 'react-icons/fa';
import { Camera, FileSpreadsheet, Presentation } from 'lucide-react';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';
import { PdfSpecImportModal } from '@/components/import/PdfSpecImportModal';
import GuidedPublishFlow from './GuidedPublishFlow';

interface ProductTag {
  id: string;
  x: number;
  y: number;
  product: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}

interface ProjectImage {
  id: string;
  url: string;
  name?: string;
  room?: string;
  tags: ProductTag[];
}

interface MediaSectionProps {
  project: {
    id: string;
    title: string;
    projectType?: string;
    city?: string | null;
    regionState?: string | null;
    rooms?: any[];
  };
  isOwner: boolean;
  images: ProjectImage[];
  projectPost?: any;
  isPublished?: boolean;
}

export default function MediaSection({ project, isOwner, images, projectPost, isPublished }: MediaSectionProps) {
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedHeroImageId, setSelectedHeroImageId] = useState<string | null>(null);
  const [existingPost, setExistingPost] = useState<any>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPresentationImport, setShowPresentationImport] = useState(false);
  const [showPdfSpecImport, setShowPdfSpecImport] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; type?: string | null }>>([]);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch rooms for PDF spec import
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await fetch(`/api/projects/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    }
    fetchRooms();
  }, [project.id]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const hasPresentationFile = files.some(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.pdf') || name.endsWith('.pptx');
      });

      if (hasPresentationFile) {
        const presentationFiles = files.filter(file => {
          const name = file.name.toLowerCase();
          return name.endsWith('.pdf') || name.endsWith('.pptx');
        });
        setPendingFiles(presentationFiles);
        setShowPresentationImport(true);
      } else {
        setShowUploadModal(true);
        const fileData = files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        }));
        sessionStorage.setItem('pendingUploadFiles', JSON.stringify(fileData));
      }
    }
  }, []);

  const handleImportPresentation = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.pptx';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (files.length > 0) {
        setPendingFiles(files);
        setShowPresentationImport(true);
      }
    };
    input.click();
  }, []);

  const handlePresentationImportComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const handlePdfSpecImportComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleImportPdfSpecs = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
        setPendingFiles(files);
        setShowPdfSpecImport(true);
      }
    };
    input.click();
  }, []);

  const handleDeleteImage = useCallback(async (imageId: string) => {
    if (!confirm('Delete this image?')) return;

    try {
      const res = await fetch(`/api/projects/${project.id}/images/${imageId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete image');
      }

      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image');
    }
  }, [project.id, router]);

  // Load existing ProjectPost to check heroAssetId
  useEffect(() => {
    if (!isOwner) return;

    async function loadPost() {
      try {
        const res = await fetch(`/api/posting/project/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setExistingPost(data.post);
          if (data.post?.heroAssetId) {
            setSelectedHeroImageId(data.post.heroAssetId);
          }
        } else if (res.status !== 404) {
          console.error('Failed to load post:', res.status);
        }
      } catch (error) {
        console.error('Error loading post:', error);
      }
    }

    loadPost();
  }, [project.id, isOwner]);

  // Use projectPost prop if available
  useEffect(() => {
    if (projectPost) {
      setExistingPost(projectPost);
      if (projectPost.heroAssetId) {
        setSelectedHeroImageId(projectPost.heroAssetId);
      }
    }
  }, [projectPost]);

  // Count uploaded media by type
  const photoCount = images.filter(img => !img.name?.match(/\.(pdf|pptx|xlsx|csv)$/i)).length;
  const presentationCount = images.filter(img => img.name?.match(/\.(pdf|pptx)$/i)).length;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <p className="folio-body text-[var(--text-secondary)]">
        Upload your project materials. We'll extract products, rooms, and specifications automatically.
      </p>

      {/* Media Type Skeleton Cards */}
      {isOwner && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Photos Card */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="group text-left rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 hover:border-[var(--accent)] hover:shadow-sm transition-all"
          >
            <Camera className="w-6 h-6 text-[var(--accent)] mb-3" />
            <h3 className="folio-ui font-semibold text-[var(--text-primary)] mb-1">Photos</h3>
            <p className="folio-meta text-[var(--text-tertiary)] mb-3">
              JPG, PNG, HEIC, WebP
            </p>
            {photoCount > 0 ? (
              <span className="folio-meta text-[var(--accent)] flex items-center gap-1">
                <FaCheckCircle className="w-3 h-3" /> {photoCount} photos uploaded
              </span>
            ) : (
              <span className="folio-meta text-[var(--accent)] group-hover:text-[var(--accent-hover)]">
                Upload
              </span>
            )}
          </button>

          {/* Presentation Card */}
          <button
            onClick={handleImportPresentation}
            className="group text-left rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 hover:border-[var(--accent)] hover:shadow-sm transition-all"
          >
            <Presentation className="w-6 h-6 text-[var(--accent)] mb-3" />
            <h3 className="folio-ui font-semibold text-[var(--text-primary)] mb-1">Presentation</h3>
            <p className="folio-meta text-[var(--text-tertiary)] mb-3">
              PPTX, PDF, Keynote
            </p>
            {presentationCount > 0 ? (
              <span className="folio-meta text-[var(--accent)] flex items-center gap-1">
                <FaCheckCircle className="w-3 h-3" /> {presentationCount} imported
              </span>
            ) : (
              <span className="folio-meta text-[var(--accent)] group-hover:text-[var(--accent-hover)]">
                Import
              </span>
            )}
          </button>

          {/* Material Schedule Card */}
          <button
            onClick={handleImportPdfSpecs}
            className="group text-left rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 hover:border-[var(--accent)] hover:shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-6 h-6 text-[var(--accent)] mb-3" />
            <h3 className="folio-ui font-semibold text-[var(--text-primary)] mb-1">Material Schedule</h3>
            <p className="folio-meta text-[var(--text-tertiary)] mb-3">
              XLSX, CSV, PDF specs
            </p>
            <span className="folio-meta text-[var(--accent)] group-hover:text-[var(--accent-hover)]">
              Import
            </span>
          </button>
        </div>
      )}

      {/* Uploaded Media Section */}
      <section
        ref={images.length > 0 ? dropZoneRef : undefined}
        onDragEnter={images.length > 0 ? handleDragEnter : undefined}
        onDragLeave={images.length > 0 ? handleDragLeave : undefined}
        onDragOver={images.length > 0 ? handleDragOver : undefined}
        onDrop={images.length > 0 ? handleDrop : undefined}
        className={`transition-all ${
          images.length > 0 && isDragOver ? 'ring-2 ring-[var(--accent)] ring-offset-2 rounded-xl' : ''
        }`}
      >
        {images.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="folio-ui font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Uploaded Media
            </h3>
            {isOwner && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 folio-meta font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <FaUpload className="w-3 h-3" />
                Add More
              </button>
            )}
          </div>
        )}

        {/* Images Grid */}
        {images.length === 0 ? (
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center
              transition-all duration-200 ease-out cursor-pointer
              ${isDragOver
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]'
                : 'border-[var(--ridge-outer)] hover:border-[var(--text-tertiary)] bg-[var(--bg-base)]'
              }
            `}
            onClick={() => setShowUploadModal(true)}
          >
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.pptx"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) {
                  const hasPresentationFile = files.some(file => {
                    const name = file.name.toLowerCase();
                    return name.endsWith('.pdf') || name.endsWith('.pptx');
                  });
                  if (hasPresentationFile) {
                    const presentationFiles = files.filter(file => {
                      const name = file.name.toLowerCase();
                      return name.endsWith('.pdf') || name.endsWith('.pptx');
                    });
                    setPendingFiles(presentationFiles);
                    setShowPresentationImport(true);
                  } else {
                    setShowUploadModal(true);
                  }
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="pointer-events-none">
              <FaCloudUploadAlt
                className={`
                  w-12 h-12 mx-auto mb-3 transition-colors duration-200
                  ${isDragOver ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
                `}
              />
              <p className="text-lg text-[var(--text-primary)] mb-1">
                {isDragOver ? 'Drop files here' : 'Drag files here to upload'}
              </p>
              <p className="folio-meta mb-4">
                Photos or presentations (PDF, PPTX)
              </p>
            </div>

            {isOwner && (
              <div className="flex items-center justify-center gap-3 pointer-events-auto mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImportPresentation();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm"
                >
                  <FaFileImport className="w-4 h-4" />
                  Import Presentation
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Drag overlay when files are being dragged over */}
            {isDragOver && (
              <div className="absolute inset-0 bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)] rounded-xl flex items-center justify-center z-10">
                <div className="text-center">
                  <FaCloudUploadAlt className="w-12 h-12 mx-auto mb-2 text-[var(--accent)]" />
                  <p className="text-lg text-[var(--accent)] font-medium">Drop files here</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((image) => {
              const isCover = selectedHeroImageId === image.id || existingPost?.heroAssetId === image.id;
              const tagCount = image.tags.length;

              return (
                <div
                  key={image.id}
                  className={`relative group aspect-[4/3] bg-[var(--bg-base)] rounded-lg overflow-hidden border-2 ${
                    isCover ? 'border-[var(--accent)]' : 'border-[var(--border-default)] hover:border-[var(--accent)]'
                  } transition-all`}
                >
                  <Image
                    src={image.url}
                    alt={image.name || 'Project image'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />

                  {/* Tag Count Badge */}
                  {tagCount > 0 && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      <FaTag className="w-3 h-3" />
                      {tagCount}
                    </div>
                  )}

                  {/* Cover Badge */}
                  {isCover && (
                    <div className="absolute top-2 left-2 bg-[var(--accent)] text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <FaCheckCircle className="w-3 h-3" />
                      Cover
                    </div>
                  )}

                  {/* Overlay Actions */}
                  {isOwner && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setSelectedHeroImageId(image.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isCover
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--bg-base)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        {isCover ? 'Cover Selected' : 'Set as Cover'}
                      </button>
                      <button
                        onClick={() => handleDeleteImage(image.id)}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}
      </section>

      {/* Guided Publish Flow — inline below image grid for unpublished projects with images */}
      {images.length > 0 && !isPublished && isOwner && (
        <GuidedPublishFlow project={project} imageCount={images.length} />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <ProjectCreationModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onProjectCreated={(updatedProject) => {
            setShowUploadModal(false);
            router.refresh();
          }}
          editingProject={project}
        />
      )}

      {/* Presentation Import Modal */}
      <PresentationImportModal
        open={showPresentationImport}
        onOpenChange={(open) => {
          setShowPresentationImport(open);
          if (!open) {
            setPendingFiles([]);
          }
        }}
        projectId={project.id}
        projectTitle={project.title}
        initialFiles={pendingFiles.length > 0 ? pendingFiles : undefined}
        onComplete={handlePresentationImportComplete}
      />

      {/* PDF Spec Import Modal */}
      <PdfSpecImportModal
        open={showPdfSpecImport}
        onOpenChange={(open) => {
          setShowPdfSpecImport(open);
          if (!open) {
            setPendingFiles([]);
          }
        }}
        projectId={project.id}
        projectTitle={project.title}
        rooms={rooms}
        initialFile={pendingFiles.length > 0 ? pendingFiles[0] : undefined}
        onComplete={handlePdfSpecImportComplete}
      />
    </div>
  );
}
