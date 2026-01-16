'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FaArrowLeft, FaRocket, FaCheckCircle, FaImage, FaTag, 
  FaExclamationTriangle, FaArrowRight, FaFileAlt, FaEdit
} from 'react-icons/fa';
import { toast } from 'sonner';

interface PublishWorkflowProps {
  project: {
    id: string;
    title: string;
    description: string | null;
    city: string | null;
    regionState: string | null;
    isPublic: boolean;
    publishedAt: Date | null;
  };
  images: Array<{
    id: string;
    url: string;
    name: string | null;
    room: string | null;
    tags: Array<{
      id: string;
      product: { id: string; name: string; brand: string | null } | null;
    }>;
  }>;
  readiness: {
    imageCount: number;
    tagCount: number;
    roomCount: number;
    isReady: boolean;
  };
  existingPost: {
    id: string;
    status: string;
    slug: string;
  } | null;
}

export default function PublishWorkflow({ 
  project, 
  images, 
  readiness,
  existingPost 
}: PublishWorkflowProps) {
  const router = useRouter();
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [step, setStep] = useState<'review' | 'draft-ready' | 'publishing' | 'done'>('review');
  const [draftInfo, setDraftInfo] = useState<{ id: string; slug: string } | null>(
    existingPost && existingPost.status === 'DRAFT' ? existingPost : null
  );

  // If draft already exists, start at draft-ready step
  useEffect(() => {
    if (existingPost?.status === 'DRAFT') {
      setStep('draft-ready');
      setDraftInfo({ id: existingPost.id, slug: existingPost.slug });
    }
  }, [existingPost]);

  // Step 1: Create draft (via API)
  const handleCreateDraft = async () => {
    if (!readiness.isReady) {
      toast.error('Please add at least one image and tag a product before creating a draft.');
      return;
    }

    setIsCreatingDraft(true);

    try {
      const response = await fetch(`/api/projects/${project.id}/approvals/draft-editorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setDraftInfo({ id: result.projectPostId, slug: result.slug });
        setStep('draft-ready');
        toast.success('Draft created! Review before publishing.');
        
        console.log('[publish_workflow] Draft created:', {
          projectId: project.id,
          postId: result.projectPostId,
        });
      } else {
        throw new Error(result.error || 'Failed to create draft');
      }
    } catch (error: any) {
      console.error('[publish_workflow] Draft error:', error);
      toast.error(error.message || 'Failed to create draft');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  // Step 2: Publish (explicit action via API)
  const handlePublish = async () => {
    setIsPublishing(true);
    setStep('publishing');

    try {
      const response = await fetch(`/api/projects/${project.id}/approvals/publish-editorial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setStep('done');
        toast.success('Editorial published successfully!');

        console.log('[publish_workflow] Published:', {
          projectId: project.id,
          imageCount: readiness.imageCount,
          tagCount: readiness.tagCount,
        });

        // Redirect to editorial view after short delay
        setTimeout(() => {
          router.push(`/project/${project.id}?view=editorial`);
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to publish');
      }
    } catch (error: any) {
      console.error('[publish_workflow] Publish error:', error);
      toast.error(error.message || 'Failed to publish');
      setStep('draft-ready');
      
      console.log('[publish_workflow] Failed:', {
        projectId: project.id,
        error: error.message,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const location = [project.city, project.regionState].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)]">
        <div className="container mx-auto px-6 py-4">
          <Link
            href={`/project/${project.id}`}
            className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            Back to Project
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12 max-w-3xl">
        {step === 'review' && (
          <>
            {/* Title */}
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
                <FaRocket className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <h1 className="folio-h1 text-[var(--text-primary)] mb-2">
                Ready to Publish?
              </h1>
              <p className="folio-body text-[var(--text-secondary)]">
                Review your project before sharing it with the design community.
              </p>
            </div>

            {/* Project Summary Card */}
            <div className="bg-[var(--bg-elevated)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden mb-8">
              <div className="p-6 border-b border-[var(--border-default)]">
                <h2 className="folio-h2 text-[var(--text-primary)]">{project.title}</h2>
                {location && (
                  <p className="text-[var(--text-secondary)] mt-1">{location}</p>
                )}
                {project.description && (
                  <p className="text-[var(--text-secondary)] mt-3 line-clamp-2">{project.description}</p>
                )}
              </div>

              {/* Image Preview */}
              {images.length > 0 && (
                <div className="p-4 bg-[var(--bg-base)]">
                  <div className="grid grid-cols-4 gap-2">
                    {images.slice(0, 4).map((img, idx) => (
                      <div
                        key={img.id}
                        className="aspect-square rounded-lg overflow-hidden bg-[var(--bg-elevated)] relative"
                      >
                        <img
                          src={img.url}
                          alt={img.name || `Image ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {img.tags.length > 0 && (
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white folio-meta px-1.5 py-0.5 rounded">
                            {img.tags.length} tags
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {images.length > 4 && (
                    <p className="folio-meta text-[var(--text-tertiary)] mt-2 text-center">
                      +{images.length - 4} more images
                    </p>
                  )}
                </div>
              )}

              {/* Readiness Stats */}
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${readiness.imageCount > 0 ? 'text-green-600' : 'text-[var(--text-tertiary)]'}`}>
                    {readiness.imageCount}
                  </div>
                  <div className="folio-ui text-[var(--text-secondary)] flex items-center justify-center gap-1">
                    <FaImage className="w-3 h-3" /> Images
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${readiness.tagCount > 0 ? 'text-green-600' : 'text-[var(--text-tertiary)]'}`}>
                    {readiness.tagCount}
                  </div>
                  <div className="folio-ui text-[var(--text-secondary)] flex items-center justify-center gap-1">
                    <FaTag className="w-3 h-3" /> Tags
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[var(--text-secondary)]">
                    {readiness.roomCount}
                  </div>
                  <div className="folio-ui text-[var(--text-secondary)]">Rooms</div>
                </div>
              </div>
            </div>

            {/* Readiness Warning */}
            {!readiness.isReady && (
              <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-4 mb-8 flex items-start gap-3">
                <FaExclamationTriangle className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">Not quite ready</h3>
                  <p className="folio-ui text-[var(--text-secondary)] mt-1">
                    {readiness.imageCount === 0
                      ? 'Upload at least one image to your project.'
                      : 'Tag at least one product in your images to unlock publishing.'}
                  </p>
                  <Link
                    href={`/project/${project.id}?view=media`}
                    className="inline-flex items-center gap-1 folio-ui font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] mt-2"
                  >
                    Go to Media <FaArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Actions - Step 1: Create Draft */}
            <div className="flex items-center justify-between">
              <Link
                href={`/project/${project.id}`}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                I'll do this later
              </Link>

              <button
                onClick={handleCreateDraft}
                disabled={!readiness.isReady || isCreatingDraft}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaFileAlt className="w-4 h-4" />
                {isCreatingDraft ? 'Creating Draft...' : 'Create Draft'}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Draft Ready - Review before publish */}
        {step === 'draft-ready' && (
          <>
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
                <FaFileAlt className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <h1 className="folio-h1 text-[var(--text-primary)] mb-2">
                Draft Ready for Review
              </h1>
              <p className="folio-body text-[var(--text-secondary)]">
                Your editorial draft is saved. Review the details below, then publish when ready.
              </p>
            </div>

            {/* Draft Preview Card */}
            <div className="bg-[var(--bg-elevated)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden mb-8">
              <div className="p-6 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 folio-meta font-medium bg-[var(--accent)]/10 text-[var(--accent)] rounded-full">
                    DRAFT
                  </span>
                </div>
                <h2 className="folio-h2 text-[var(--text-primary)]">{project.title}</h2>
                {location && (
                  <p className="text-[var(--text-secondary)] mt-1">{location}</p>
                )}
                {project.description && (
                  <p className="text-[var(--text-secondary)] mt-3 line-clamp-2">{project.description}</p>
                )}
              </div>

              {/* Cover Image Selection */}
              {images.length > 0 && (
                <div className="p-4 bg-[var(--bg-base)] border-b border-[var(--border-default)]">
                  <p className="folio-ui font-medium text-[var(--text-primary)] mb-2">Cover Image</p>
                  <div className="aspect-video rounded-lg overflow-hidden bg-[var(--bg-elevated)] max-w-md">
                    <img
                      src={images[0].url}
                      alt={images[0].name || 'Cover image'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="folio-meta text-[var(--text-tertiary)] mt-2">First uploaded image will be used as the cover</p>
                </div>
              )}

              {/* What will be published */}
              <div className="p-6">
                <h3 className="folio-ui font-medium text-[var(--text-primary)] mb-3">What will be published:</h3>
                <ul className="space-y-2 folio-ui text-[var(--text-secondary)]">
                  <li className="flex items-center gap-2">
                    <FaCheckCircle className="w-4 h-4 text-green-500" />
                    {readiness.imageCount} images across {readiness.roomCount} room(s)
                  </li>
                  <li className="flex items-center gap-2">
                    <FaCheckCircle className="w-4 h-4 text-green-500" />
                    {readiness.tagCount} tagged product(s) visible in editorial
                  </li>
                  <li className="flex items-center gap-2">
                    <FaCheckCircle className="w-4 h-4 text-green-500" />
                    Project will appear in the community feed
                  </li>
                </ul>
              </div>
            </div>

            {/* Edit / Publish Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/project/${project.id}?view=media`}
                  className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <FaEdit className="w-4 h-4" />
                  Edit project
                </Link>
                <Link
                  href={`/project/${project.id}`}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Back to overview
                </Link>
              </div>

              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaRocket className="w-4 h-4" />
                {isPublishing ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </>
        )}

        {step === 'publishing' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
            </div>
            <h2 className="folio-h2 text-[var(--text-primary)] mb-2">Publishing...</h2>
            <p className="folio-body text-[var(--text-secondary)]">Sharing your project with the community.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <FaCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="folio-h2 text-[var(--text-primary)] mb-2">Published!</h2>
            <p className="folio-body text-[var(--text-secondary)] mb-6">Your project is now live. Redirecting to your editorial...</p>
            <Link
              href={`/project/${project.id}?view=editorial`}
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
            >
              View Editorial <FaArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

