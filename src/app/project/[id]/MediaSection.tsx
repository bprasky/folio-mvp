'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaUpload, FaImages, FaPlus, FaTag, FaRocket, FaCheckCircle } from 'react-icons/fa';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { InterviewModal } from '@/components/posting/interview/InterviewModal';
import { FinishScheduleOptionsModal } from '@/components/posting/FinishScheduleOptionsModal';

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
      <section className="bg-[var(--bg-elevated)] p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="folio-h2 flex items-center gap-3">
            <FaImages className="w-8 h-8 text-[var(--accent)]" />
            Project Media
          </h2>
          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
              >
                <FaUpload className="w-4 h-4" />
                Upload Media
              </button>
            )}
            {isOwner && POSTING_V1_ENABLED && (
              <button
                onClick={() => {
                  // Show finish schedule options before interview
                  setShowFinishScheduleModal(true);
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
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <FaImages className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="folio-body mb-2">No images uploaded yet</p>
            {isOwner && (
              <p className="folio-ui">Click "Upload Media" to add images and tag products</p>
            )}
          </div>
        ) : (
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
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Interview Modal */}
      {showInterviewModal && (
        <InterviewModal
          open={showInterviewModal}
          onOpenChange={setShowInterviewModal}
          projectId={project.id}
          images={images}
          post={existingPost}
          hasVendors={false} // TODO: detect if project has vendor tags
          tags={images.flatMap((img) => img.tags)}
        />
      )}
    </div>
  );
}
