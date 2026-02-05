'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUpload, FaImages, FaPlus, FaTag, FaRocket, FaCheckCircle, FaCloudUploadAlt, FaFileImport, FaTrash } from 'react-icons/fa';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { InterviewFlow } from '@/components/interview';
import { TagDiagnosticModal } from '@/components/posting/interview/TagDiagnosticModal';
import { FinishScheduleOptionsModal } from '@/components/posting/FinishScheduleOptionsModal';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';
import { PdfSpecImportModal } from '@/components/import/PdfSpecImportModal';

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
  };
  isOwner: boolean;
  images: ProjectImage[];
  projectPost?: any;
}

const POSTING_V1_ENABLED = process.env.NEXT_PUBLIC_POSTING_V1 === 'true';

export default function MediaSection({ project, isOwner, images, projectPost }: MediaSectionProps) {
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFinishScheduleModal, setShowFinishScheduleModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showTagDiagnostic, setShowTagDiagnostic] = useState(false);
  const [selectedHeroImageId, setSelectedHeroImageId] = useState<string | null>(null);
  const [existingPost, setExistingPost] = useState<any>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [llmWarning, setLlmWarning] = useState<string | null>(null);
  const [checklistBanner, setChecklistBanner] = useState<{
    hasImages: boolean;
    hasTags: boolean;
    hasCover: boolean;
  } | null>(null);

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
    if (!POSTING_V1_ENABLED || !isOwner) return;

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

  // Compute checklist state
  useEffect(() => {
    if (!POSTING_V1_ENABLED) return;

    const hasImages = images.length > 0;
    const hasAtLeastOneTag = images.some(img => img.tags.length > 0);
    const hasCover = !!selectedHeroImageId || !!existingPost?.heroAssetId;

    setChecklistBanner({
      hasImages,
      hasTags: hasAtLeastOneTag,
      hasCover,
    });
  }, [images, selectedHeroImageId, existingPost, POSTING_V1_ENABLED]);

  async function handlePublish() {
    if (!POSTING_V1_ENABLED) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      // 1. Check if ProjectPost exists, create if not
      let postRes = await fetch(`/api/posting/project/${project.id}`);
      
      if (postRes.status === 404) {
        // Init post
        const initRes = await fetch(`/api/posting/project/${project.id}/init`, {
          method: 'POST',
        });
        if (!initRes.ok) {
          const error = await initRes.json();
          throw new Error(error.error || 'Failed to initialize post');
        }
        postRes = await fetch(`/api/posting/project/${project.id}`);
      }

      if (!postRes.ok) {
        throw new Error('Failed to fetch post');
      }

      const postData = await postRes.json();
      const post = postData.post;

      // 2. Set heroAssetId
      const heroImageId = selectedHeroImageId || images[0]?.id;
      if (heroImageId) {
        const metaRes = await fetch(`/api/posting/project/${project.id}/meta`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heroAssetId: heroImageId }),
        });

        if (!metaRes.ok) {
          const error = await metaRes.json();
          throw new Error(error.error || 'Failed to set cover image');
        }
      }

      // 3. Log analytics (non-blocking)
      // Note: Analytics is logged server-side when ProjectPost is created/updated
      // Client-side logging can be added via a server action if needed

      // 4. Redirect to preview
      router.push(`/designer/projects/${project.id}/preview`);
    } catch (error: any) {
      console.error('Publish error:', error);
      setPublishError(error.message || 'Failed to publish');
      setIsPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <section
        ref={images.length > 0 ? dropZoneRef : undefined}
        onDragEnter={images.length > 0 ? handleDragEnter : undefined}
        onDragLeave={images.length > 0 ? handleDragLeave : undefined}
        onDragOver={images.length > 0 ? handleDragOver : undefined}
        onDrop={images.length > 0 ? handleDrop : undefined}
        className={`bg-[var(--bg-elevated)] p-6 rounded-lg shadow-md transition-all ${
          images.length > 0 && isDragOver ? 'ring-2 ring-[var(--accent)] ring-offset-2' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="folio-h2 flex items-center gap-3">
            <FaImages className="w-8 h-8 text-[var(--accent)]" />
            Project Files
          </h2>
          <div className="flex items-center gap-3">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                >
                  <FaUpload className="w-4 h-4" />
                  Upload Media
                </button>
                <button
                  onClick={handleImportPresentation}
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-base)] transition-colors"
                >
                  <FaFileImport className="w-4 h-4" />
                  Import Presentation
                </button>
                <button
                  onClick={handleImportPdfSpecs}
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-base)] transition-colors"
                  title="Extract product specs from PDF (brand, price, dimensions)"
                >
                  <FaTag className="w-4 h-4" />
                  Import PDF Specs
                </button>
              </>
            )}
            {isOwner && POSTING_V1_ENABLED && (
              <button
                onClick={() => {
                  // Check tag diagnostic first, then open interview
                  fetch(`/api/posting/project/${project.id}/tag-diagnostic`)
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data) => {
                      if (data?.summary?.needsAttention) {
                        setShowTagDiagnostic(true);
                      } else {
                        setShowInterviewModal(true);
                      }
                    })
                    .catch(() => setShowInterviewModal(true));
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaRocket className="w-4 h-4" />
                Continue to Interview
              </button>
            )}
          </div>
        </div>

        {/* Draft Checklist Banner */}
        {POSTING_V1_ENABLED && checklistBanner && (
          <div className={`mb-6 p-4 rounded-lg border ${
            checklistBanner.hasImages && checklistBanner.hasTags && checklistBanner.hasCover
              ? 'bg-green-50 border-green-200'
              : 'bg-[var(--accent)]/10 border-[var(--accent)]/20'
          }`}>
            <div className="flex items-start gap-3">
              <FaCheckCircle className={`w-5 h-5 mt-0.5 ${
                checklistBanner.hasImages && checklistBanner.hasTags && checklistBanner.hasCover
                  ? 'text-green-600'
                  : 'text-[var(--accent)]'
              }`} />
              <div className="flex-1">
                <h3 className="font-medium mb-2 text-[var(--text-primary)]">Publish Checklist</h3>
                <ul className="space-y-1 folio-ui">
                  <li className={checklistBanner.hasImages ? 'text-green-700' : 'text-[var(--accent)]'}>
                    {checklistBanner.hasImages ? '✓' : '○'} At least 1 image uploaded
                  </li>
                  <li className={checklistBanner.hasTags ? 'text-green-700' : 'text-[var(--accent)]'}>
                    {checklistBanner.hasTags ? '✓' : '○'} At least 1 product tagged
                  </li>
                  <li className={checklistBanner.hasCover ? 'text-green-700' : 'text-[var(--accent)]'}>
                    {checklistBanner.hasCover ? '✓' : '○'} Cover image selected
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {publishError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {publishError}
          </div>
        )}

        {/* LLM Warning */}
        {llmWarning && (
          <div className="mb-6 p-4 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] rounded-lg folio-ui">
            {llmWarning}
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
                    isCover ? 'border-green-500' : 'border-[var(--border-default)] hover:border-[var(--accent)]'
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
                    <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
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
                            ? 'bg-green-600 text-white'
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

      {/* Upload Modal */}
      {showUploadModal && (
        <ProjectCreationModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onProjectCreated={(updatedProject) => {
            setShowUploadModal(false);
            // Refresh page to show new images
            router.refresh();
          }}
          editingProject={project}
        />
      )}

      {/* Finish Schedule Options Modal */}
      {showFinishScheduleModal && (
        <FinishScheduleOptionsModal
          open={showFinishScheduleModal}
          onOpenChange={setShowFinishScheduleModal}
          projectId={project.id}
          onComplete={async (option) => {
            setShowFinishScheduleModal(false);

            // Check LLM availability before opening interview modal
            try {
              const res = await fetch("/api/health/llm");
              const data = await res.json();
              if (!data.ok) {
                setLlmWarning("AI not configured—using clean template.");
              }
            } catch {
              // Ignore health check failures
            }

            // If they uploaded a finish schedule, refresh to show new tags
            if (option === 'uploaded') {
              router.refresh();
            }

            // Proceed to interview
            setShowInterviewModal(true);
          }}
        />
      )}

      {/* Tag Diagnostic Modal */}
      {showTagDiagnostic && (
        <TagDiagnosticModal
          open={showTagDiagnostic}
          onOpenChange={(open) => {
            setShowTagDiagnostic(open);
          }}
          projectId={project.id}
          onAutoTagComplete={() => {
            // Refresh page to pick up new tags
            router.refresh();
          }}
          onStartInterview={() => {
            setShowTagDiagnostic(false);
            setShowInterviewModal(true);
          }}
        />
      )}

      {/* New Interview Flow */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowInterviewModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
            <InterviewFlow
              projectId={project.id}
              projectName={project.title}
              images={images.map(img => ({ id: img.id, url: img.url, name: img.name }))}
              onComplete={(draftId) => {
                setShowInterviewModal(false);
                // Navigate to preview or editorial page
                router.push(`/designer/projects/${project.id}/preview`);
              }}
              onCancel={() => setShowInterviewModal(false)}
            />
          </div>
        </div>
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
