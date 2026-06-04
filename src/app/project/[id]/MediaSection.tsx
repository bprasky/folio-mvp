'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaUpload, FaCloudUploadAlt, FaFileImport } from 'react-icons/fa';
import RoomGroupedMedia from './RoomGroupedMedia';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';
import { PdfSpecImportModal } from '@/components/import/PdfSpecImportModal';
import { InterviewModal } from '@/components/posting/interview/InterviewModal';
import { ProjectImageTagger } from '@/components/project/ProjectImageTagger';
import MaterialsStep from './MaterialsStep';
import DocumentImportModal from './DocumentImportModal';
import TagReviewPanel from './TagReviewPanel';
import type { EditorialState } from '@/lib/editorial/getEditorialState';

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
  room?: string | null;
  roomId?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  noProducts?: boolean;
  aiSpaces?: string[];
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
  editorialState?: EditorialState;
}

export default function MediaSection({ project, isOwner, images, projectPost }: MediaSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showTagger, setShowTagger] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showTagReview, setShowTagReview] = useState(false);
  const [selectedHeroImageId, setSelectedHeroImageId] = useState<string | null>(null);
  const [existingPost, setExistingPost] = useState<any>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPresentationImport, setShowPresentationImport] = useState(false);
  const [showPdfSpecImport, setShowPdfSpecImport] = useState(false);
  const [showDocImport, setShowDocImport] = useState(false);
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

  // Fire background analysis for any new unanalyzed images
  const triggerBackgroundAnalysis = useCallback(() => {
    fetch(`/api/projects/${project.id}/analyze-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(err => console.error('[MediaSection] Background analysis failed:', err));
  }, [project.id]);

  const handlePresentationImportComplete = useCallback(() => {
    triggerBackgroundAnalysis();
    router.refresh();
  }, [router, triggerBackgroundAnalysis]);

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

  // Spreadsheets have no review modal; post straight to the finish-schedule call.
  const handleFinishScheduleUpload = useCallback(
    async (file: File) => {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('projectId', project.id);
        const res = await fetch('/api/import/finish-schedule', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');
        router.refresh();
      } catch (err) {
        console.error('[MediaSection] finish-schedule import failed:', err);
        alert(err instanceof Error ? err.message : 'Failed to import that file');
      }
    },
    [project.id, router],
  );

  // Single document upload, routed to the dedicated pipeline by file type:
  // PDF -> the PDF spec extractor, PowerPoint -> the presentation importer,
  // spreadsheet -> the finish-schedule call.
  const routeDocument = useCallback(
    (file: File) => {
      setShowDocImport(false);
      const lower = file.name.toLowerCase();
      if (/\.(xlsx|xls|csv)$/.test(lower)) {
        handleFinishScheduleUpload(file);
        return;
      }
      setPendingFiles([file]);
      if (lower.endsWith('.pdf')) {
        setShowPdfSpecImport(true);
      } else {
        setShowPresentationImport(true);
      }
    },
    [handleFinishScheduleUpload],
  );

  // --- Progress tracker dispatch -----------------------------------------
  // The tracker (top of the page) names a flow via `?action=` and routes here.
  // Open the matching existing flow, then strip the param so a refresh or a
  // back-navigation does not re-trigger it. Each import modal self-serves file
  // selection, so opening it directly is enough.
  useEffect(() => {
    const action = searchParams.get('action');
    if (!action) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    router.replace(`/project/${project.id}?${params.toString()}`, { scroll: false });

    switch (action) {
      case 'upload':
        setShowUploadModal(true);
        break;
      case 'sort-rooms':
        document
          .getElementById('uploaded-media-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'import-doc':
        // One upload for every document type. DocumentImportModal hands the file
        // back to routeDocument, which dispatches to the dedicated pipeline by
        // file type.
        setShowDocImport(true);
        break;
      case 'materials':
        setShowMaterials(true);
        break;
      case 'tag':
        setShowTagReview(true);
        break;
      case 'tag-by-hand':
        setShowTagger(true);
        break;
      case 'interview':
        setShowInterviewModal(true);
        break;
    }
  }, [searchParams, router, project.id]);

  const handleDraftGenerated = useCallback(() => {
    router.push(`/project/${project.id}?view=publish`);
  }, [router, project.id]);

  const handleSetCover = useCallback(async (imageId: string) => {
    setSelectedHeroImageId(imageId);
    try {
      const res = await fetch(`/api/posting/project/${project.id}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroAssetId: imageId }),
      });
      if (!res.ok) {
        console.error('Failed to set cover image:', res.status);
        // Revert on failure
        setSelectedHeroImageId(existingPost?.heroAssetId ?? null);
        return;
      }
      const data = await res.json();
      setExistingPost(data.post);
    } catch (error) {
      console.error('Error setting cover image:', error);
      setSelectedHeroImageId(existingPost?.heroAssetId ?? null);
    }
  }, [project.id, existingPost]);

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

  return (
    <div className="space-y-6">
      {/* The progress tracker at the top of the page now owns the "what's next"
          guidance and every import entry point. This surface is just the media
          itself plus the flows the tracker routes into. */}

      {/* Uploaded Media Section */}
      <section
        id="uploaded-media-section"
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
            <h3 className="folio-ui font-semibold text-folio-text-secondary uppercase tracking-wider">
              Uploaded Media
            </h3>
            {isOwner && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 folio-meta font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors"
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
                : 'border-folio-border-subtle hover:border-folio-text-tertiary bg-surface-canvas'
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
                  ${isDragOver ? 'text-[var(--accent)]' : 'text-folio-text-tertiary'}
                `}
              />
              <p className="text-lg text-folio-text-primary mb-1">
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
            <RoomGroupedMedia
              projectId={project.id}
              isOwner={isOwner}
              images={images}
              rooms={(project.rooms ?? []) as Array<{ id: string; name: string; type?: string | null }>}
              selectedHeroImageId={selectedHeroImageId}
              heroAssetId={existingPost?.heroAssetId ?? null}
              onSetCover={handleSetCover}
              onDelete={handleDeleteImage}
              onChanged={() => router.refresh()}
            />
          </div>
        )}
      </section>

      {/* Interview — opened by the spine's Story CTA (spec 20 §5). */}
      <InterviewModal
        open={showInterviewModal}
        onOpenChange={setShowInterviewModal}
        projectId={project.id}
        projectName={project.title}
        images={images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
        post={projectPost}
        onDraftGenerated={handleDraftGenerated}
      />

      {/* Materials step — in-brand replacement for the blue modal (spec 20 §3d). */}
      <MaterialsStep
        open={showMaterials}
        onClose={() => setShowMaterials(false)}
        onUploadFinishSchedule={handleImportPdfSpecs}
        onTagByHand={() => setShowTagger(true)}
      />

      {/* Tag review — drives every included photo to REVIEWED. */}
      <TagReviewPanel
        open={showTagReview}
        onClose={() => setShowTagReview(false)}
        projectId={project.id}
        images={images}
        rooms={(project.rooms ?? []) as Array<{ id: string; name: string }>}
        onTagPhoto={() => {
          setShowTagReview(false);
          setShowTagger(true);
        }}
        onChanged={() => router.refresh()}
      />

      {/* Manual product tagger — opened from Materials / tag review. */}
      {showTagger && (
        <ProjectImageTagger
          projectId={project.id}
          onClose={() => {
            setShowTagger(false);
            router.refresh();
          }}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <ProjectCreationModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onProjectCreated={(updatedProject) => {
            setShowUploadModal(false);
            triggerBackgroundAnalysis();
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

      {/* Document import — one upload, routed to the dedicated pipeline by type. */}
      <DocumentImportModal
        open={showDocImport}
        onClose={() => setShowDocImport(false)}
        onSelect={routeDocument}
      />

      {/* PDF Spec Import Modal. Keyed on the handed file so a routed upload loads
          into a fresh instance (the modal seeds its file from initialFile once). */}
      <PdfSpecImportModal
        key={pendingFiles[0]?.name ?? 'pdf-spec'}
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
