"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PostCard } from "@/components/posting/PostCard";
import { PostCondensed } from "@/components/posting/PostCondensed";
import { PostExpanded } from "@/components/posting/PostExpanded";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { TagDiagnosticModal } from "@/components/posting/interview/TagDiagnosticModal";
import { RichArticle } from "@/components/posting/preview/RichArticle";
import { Blocks } from "@/lib/posting/schemas";

const POSTING_V1_ENABLED = process.env.NEXT_PUBLIC_POSTING_V1 === "true";

export default function ProjectPostPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const [view, setView] = useState<"card" | "condensed" | "expanded" | "article">("article");
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [validationWarning, setValidationWarning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showTagDiagnostic, setShowTagDiagnostic] = useState(false);
  const hasProcessedStartInterview = useRef(false);
  const hasCheckedDiagnostic = useRef(false);

  useEffect(() => {
    if (!POSTING_V1_ENABLED) {
      setLoading(false);
      return;
    }

    // Reset the refs when projectId changes
    hasProcessedStartInterview.current = false;
    hasCheckedDiagnostic.current = false;
    fetchPost();
  }, [projectId]);

  // Auto-open interview modal if startInterview query param is present
  useEffect(() => {
    const shouldStartInterview = searchParams?.get('startInterview') === 'true';
    
    console.log('[preview] Checking startInterview', { 
      shouldStartInterview, 
      hasProcessed: hasProcessedStartInterview.current, 
      loading, 
      hasPost: !!post,
      postId: post?.post?.id 
    });
    
    // Only process once, and only when post is loaded
    if (shouldStartInterview && !hasProcessedStartInterview.current && !loading && post) {
      hasProcessedStartInterview.current = true;
      console.log('[preview] Auto-opening interview modal from startInterview param', { postId: post?.post?.id });

      // Remove the query param from URL to clean up
      const url = new URL(window.location.href);
      url.searchParams.delete('startInterview');
      window.history.replaceState({}, '', url.toString());

      // Check tag diagnostic first — show it if there are auto-taggable rooms
      if (!hasCheckedDiagnostic.current) {
        hasCheckedDiagnostic.current = true;
        fetch(`/api/posting/project/${projectId}/tag-diagnostic`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.summary?.needsAttention) {
              console.log('[preview] Tag diagnostic needs attention, showing modal first');
              setShowTagDiagnostic(true);
            } else {
              setShowInterviewModal(true);
            }
          })
          .catch(() => {
            // On error, just proceed to interview
            setShowInterviewModal(true);
          });
      } else {
        setTimeout(() => setShowInterviewModal(true), 200);
      }
    } else if (shouldStartInterview && !loading && !post) {
      // If post doesn't exist, we might need to initialize it first
      console.warn('[preview] startInterview=true but post is null - post may need to be initialized');
      // Try to initialize post if it doesn't exist
      if (!initializing) {
        console.log('[preview] Initializing post before opening interview modal');
        handleInitialize().then(() => {
          // After initialization, fetchPost will be called, which will trigger the modal open
          // The useEffect will run again when post is loaded
        });
      }
    }
  }, [searchParams, post, loading]);

  useEffect(() => {
    if (!POSTING_V1_ENABLED) return;
    if (typeof window === "undefined") return;
    const flag = window.sessionStorage.getItem(
      getValidationStorageKey(projectId)
    );
    setValidationWarning(flag === "validation_failed");
  }, [projectId, showInterviewModal]);

  async function fetchPost() {
    try {
      const res = await fetch(`/api/posting/project/${projectId}`, { cache: 'no-store' });

      if (res.status === 404) {
        setPost(null);
      } else if (res.ok) {
        const data = await res.json();
        const postData = data.post;
        const projectData = postData.project;
        const heroImage = postData.heroAssetId
          ? projectData.images?.find((img: any) => img.id === postData.heroAssetId)
          : projectData.images?.[0];

        setPost({
          post: {
            id: postData.id,
            status: postData.status,
            slug: postData.slug,
            excerpt: postData.excerpt,
            expandedBlocks: postData.expandedBlocks,
            credits: postData.credits,
          },
          project: {
            id: projectData.id,
            title: projectData.title,
            description: projectData.description,
          },
          heroImage: heroImage ? { id: heroImage.id, url: heroImage.url } : null,
          images: projectData.images || [],
          tags:
            projectData.images?.flatMap((img: any) =>
              img.tags?.map((tag: any) => ({
                id: tag.id,
                imageId: img.id,
                productId: tag.product.id,
                productName: tag.product.name,
              })) || []
            ) || [],
          designer: projectData.designer,
        });
      }
    } catch (error) {
      console.error("[preview] Error fetching post:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInitialize() {
    setInitializing(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/init`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchPost();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to initialize post");
      }
    } catch (error) {
      console.error("[preview] Error initializing:", error);
      alert("Failed to initialize post");
    } finally {
      setInitializing(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/interview/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }), // Always overwrite existing drafts
        }
      );

      if (res.status === 202) {
        // Generation in progress
        setGenerateError("Generation is already in progress. Please wait...");
        return;
      }

      if (res.status === 429) {
        const data = await res.json();
        const resetAt = data.resetAt
          ? new Date(data.resetAt).toLocaleTimeString()
          : "soon";
        setGenerateError(`Rate limit reached. Try again ${resetAt}.`);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error || "Failed to generate draft");
        return;
      }

      // Success - refetch and show article
      await fetchPost();
      setView("article");
      setShowRegenerateConfirm(false);
    } catch (error: any) {
      console.error("[preview] Error generating:", error);
      setGenerateError(error?.message || "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!confirm("Are you sure you want to publish this draft to the feed? This will make it publicly visible.")) {
      return;
    }

    setGenerateError(null); // Clear any previous errors

    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Handle different error status codes
        let errorMessage = data.error || "Failed to publish draft";
        
        if (data.details && Array.isArray(data.details)) {
          // 422 Unprocessable Entity - validation errors
          const detailsList = data.details.map((d: string) => `• ${d}`).join("\n");
          errorMessage = `${data.message || errorMessage}\n\n${detailsList}`;
        } else if (data.message) {
          errorMessage = `${errorMessage}: ${data.message}`;
        } else if (data.issues && Array.isArray(data.issues)) {
          // Zod validation issues
          errorMessage = `${errorMessage}: ${data.issues.map((i: any) => i.message).join(", ")}`;
        }

        setGenerateError(errorMessage);
        console.error("[preview] Publish failed:", { status: res.status, data });
        return;
      }

      // Success - refetch to show updated status
      await fetchPost();
      setGenerateError(null);
      
      // Show success message
      if (data.slug) {
        alert(`Draft published successfully! Slug: ${data.slug}`);
      } else {
        alert("Draft published successfully!");
      }
    } catch (error: any) {
      console.error("[preview] Error publishing:", error);
      setGenerateError(`Network error: ${error?.message || "Failed to publish draft"}`);
    }
  }

  if (!POSTING_V1_ENABLED) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">
        Posting feature is disabled. Set NEXT_PUBLIC_POSTING_V1=true to enable.
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!post) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Post Preview</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          No post exists for this project yet. Initialize a post to start creating your publication.
        </p>
        <button
          onClick={handleInitialize}
          disabled={initializing}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {initializing ? "Initializing..." : "Initialize Post"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Post Preview</h1>

      {validationWarning && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Some answers didn’t save due to validation—open the editor to fix.
        </div>
      )}

      <div className="border-b border-[var(--ridge-outer)] mb-8">
        <nav className="flex gap-4">
          <button
            onClick={() => setView("article")}
            className={`px-4 py-2 border-b-2 ${
              view === "article"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Article
          </button>
          <button
            onClick={() => setView("card")}
            className={`px-4 py-2 border-b-2 ${
              view === "card"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Card
          </button>
          <button
            onClick={() => setView("condensed")}
            className={`px-4 py-2 border-b-2 ${
              view === "condensed"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Condensed
          </button>
          <button
            onClick={() => setView("expanded")}
            className={`px-4 py-2 border-b-2 ${
              view === "expanded"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Expanded
          </button>
        </nav>
      </div>

      {/* Error message (show for both generation and publish errors) */}
      {generateError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-line">
          {generateError}
        </div>
      )}

      {/* Generate button or error message */}
      {!post.post.expandedBlocks && (
        <div className="mb-6 text-center py-8">
          <p className="text-[var(--text-secondary)] mb-4">
            No article draft exists yet. Generate an AI draft from your interview answers.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full px-6 py-3 font-medium shadow-md hover:shadow-lg bg-[var(--accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {generating ? "Generating…" : "Generate AI Draft"}
          </button>
        </div>
      )}

      {/* Article View */}
      {view === "article" && post.post.expandedBlocks && (
        <RichArticle
          article={post.post.expandedBlocks as Blocks}
          heroImage={post.heroImage}
          tags={post.tags}
          author={post.designer}
          projectTitle={post.project.title}
          images={post.images?.map((img: any) => ({
            id: img.id,
            url: img.url,
            caption: img.caption,
          }))}
        />
      )}

      {/* Legacy Views */}
      <div className="bg-white rounded-lg border border-[var(--ridge-outer)] p-8">
        {view === "card" && post && (
          <PostCard
            post={post.post}
            project={post.project}
            heroImage={post.heroImage}
            designer={post.designer}
          />
        )}
        {view === "condensed" && post && <PostCondensed payload={post} />}
        {view === "expanded" && post && <PostExpanded payload={post} />}
      </div>

      {post.post && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-[var(--text-secondary)]">
            Status: <span className="font-semibold">{post.post.status}</span>
            {post.post.slug && (
              <>
                {" • "}Slug:{" "}
                <code className="bg-[var(--bg-elevated)] px-2 py-1 rounded">
                  {post.post.slug}
                </code>
              </>
            )}
          </div>
          <div className="flex gap-3">
            {post.post.expandedBlocks && post.post.status !== "PUBLISHED" && (
              <button
                onClick={handlePublish}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Publish to Feed
              </button>
            )}
            {post.post.expandedBlocks && (
              <button
                onClick={() => setShowInterviewModal(true)}
                className="px-4 py-2 text-sm font-medium text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/10 transition-colors"
              >
                Edit Answers / Regenerate
              </button>
            )}
          </div>
        </div>
      )}

      {showTagDiagnostic && (
        <TagDiagnosticModal
          open={showTagDiagnostic}
          onOpenChange={(open) => {
            setShowTagDiagnostic(open);
          }}
          projectId={projectId}
          onAutoTagComplete={() => fetchPost()}
          onStartInterview={() => {
            setShowTagDiagnostic(false);
            fetchPost().then(() => setShowInterviewModal(true));
          }}
        />
      )}

      {showInterviewModal && post && (
        <InterviewModal
          open={showInterviewModal}
          onOpenChange={(open) => {
            setShowInterviewModal(open);
            if (!open) {
              fetchPost();
            }
          }}
          projectId={projectId}
          images={post.images || []}
          post={post.post}
          hasVendors={false}
          tags={
            post.tags?.map((tag: any) => ({
              product: {
                id: tag.productId,
                name: tag.productName,
                imageUrl: undefined,
                vendor: { name: undefined },
              },
            })) || []
          }
        />
      )}
    </div>
  );
}

function getValidationStorageKey(projectId: string) {
  return `folio.interview.validation.${projectId}`;
}
