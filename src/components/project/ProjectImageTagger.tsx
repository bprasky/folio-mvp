"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FaTimes, FaTag, FaCheck, FaTrash, FaExclamationCircle } from "react-icons/fa";
import { ProductTagPicker } from "./ProductTagPicker";
import { ProductEditModal } from "./ProductEditModal";

type ImageWithTags = {
  id: string;
  url: string;
  room: string | null;
  tags: Array<{
    id: string;
    x: number;
    y: number;
    productId: string;
    reviewedAt: string | null;
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      brand: string | null;
      scrapeStatus?: string | null;
    } | null;
  }>;
};

// Images may be handed in by the parent (the project page already loads them
// with tags). Shape is intentionally loose so both the Media and Publish
// surfaces can pass their existing image lists without reshaping.
type IncomingImage = {
  id: string;
  url: string;
  room?: string | null;
  tags?: Array<{
    id: string;
    x: number;
    y: number;
    productId?: string;
    reviewedAt?: string | null;
    product?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      brand?: string | null;
      scrapeStatus?: string | null;
    } | null;
  }>;
};

type Props = {
  projectId: string;
  /**
   * Images already loaded by the parent (same data the project page renders).
   * When provided, the tagger seeds from these so it never shows "no photos"
   * for a project whose images are visible on the page, regardless of whether
   * the standalone fetch endpoints succeed.
   */
  images?: IncomingImage[];
  onClose: () => void;
};

function normalizeImages(incoming: IncomingImage[]): ImageWithTags[] {
  return incoming.map((img) => ({
    id: img.id,
    url: img.url,
    room: img.room ?? null,
    tags: (img.tags ?? []).map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      productId: t.productId ?? t.product?.id ?? "",
      reviewedAt: t.reviewedAt ?? null,
      product: t.product
        ? {
            id: t.product.id,
            name: t.product.name,
            imageUrl: t.product.imageUrl ?? null,
            brand: t.product.brand ?? null,
            scrapeStatus: t.product.scrapeStatus ?? null,
          }
        : null,
    })),
  }));
}

/**
 * ProjectImageTagger — a modal-style UI for manually tagging products on
 * project images. Shows all project images, lets the designer pick one,
 * click to place a dot, then search/select a product via ProductTagPicker.
 */
export function ProjectImageTagger({ projectId, images: providedImages, onClose }: Props) {
  const [images, setImages] = useState<ImageWithTags[]>(() =>
    providedImages ? normalizeImages(providedImages) : []
  );
  const [loading, setLoading] = useState(!providedImages);
  const [activeImage, setActiveImage] = useState<ImageWithTags | null>(null);

  // Tagging state — a placed dot opens the product picker for that dot.
  const [pendingDot, setPendingDot] = useState<{ x: number; y: number } | null>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);

  // Products currently being filled by the background BQL rung (flagged domains).
  // The tag shows a pending state until the scrape resolves.
  const [scrapingIds, setScrapingIds] = useState<Set<string>>(new Set());
  // Deferred scrapes that finished with gaps: productId -> missing field labels.
  const [reviewFlags, setReviewFlags] = useState<Record<string, string[]>>({});
  // Dismissible "fetching in the background" banner shown while scrapes run.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Edit-an-existing-tagged-product modal (designer enrichment). Null when closed.
  const [editState, setEditState] = useState<{ productId: string; tagId: string | null } | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Drag state — refs to avoid re-renders during drag
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragDidMove = useRef(false);
  const justFinishedDrag = useRef(false);

  // Keep the hover popup reachable: moving the cursor from the dot up to the
  // popup briefly leaves the dot's hit-area, so hide on a short grace delay that
  // any re-entry (dot or popup) cancels.
  const hoverHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHideTag = useCallback(() => {
    if (hoverHideTimer.current) {
      clearTimeout(hoverHideTimer.current);
      hoverHideTimer.current = null;
    }
  }, []);
  const showTag = useCallback((id: string) => {
    cancelHideTag();
    setHoveredTagId(id);
  }, [cancelHideTag]);
  const scheduleHideTag = useCallback(() => {
    cancelHideTag();
    hoverHideTimer.current = setTimeout(() => {
      setHoveredTagId(null);
      hoverHideTimer.current = null;
    }, 280);
  }, [cancelHideTag]);
  useEffect(() => () => cancelHideTag(), [cancelHideTag]);

  const fetchImages = useCallback(async () => {
    const imageMap = new Map<string, ImageWithTags>();

    // 1. Existing tags. Best-effort: a failure here must not hide the
    //    project's untagged photos.
    try {
      const res = await fetch(`/api/tag-product-to-image?projectId=${projectId}`);
      if (res.ok) {
        const tags: any[] = await res.json();
        for (const tag of tags) {
          const imgId = tag.imageId ?? tag.image?.id;
          const imgUrl = tag.image?.url;
          if (!imgId || !imgUrl) continue;

          if (!imageMap.has(imgId)) {
            imageMap.set(imgId, { id: imgId, url: imgUrl, room: null, tags: [] });
          }
          imageMap.get(imgId)!.tags.push({
            id: tag.id,
            x: tag.x,
            y: tag.y,
            productId: tag.productId,
            reviewedAt: tag.reviewedAt ?? null,
            product: tag.product,
          });
        }
      }
    } catch (err) {
      console.error("[ProjectImageTagger] tag fetch error:", err);
    }

    // 2. All project images, including any with no tags yet. Best-effort.
    try {
      const projRes = await fetch(`/api/designer/projects/${projectId}`);
      if (projRes.ok) {
        const projData = await projRes.json();
        const projectImages = projData.images || projData.project?.images || [];
        for (const img of projectImages) {
          if (!imageMap.has(img.id)) {
            imageMap.set(img.id, {
              id: img.id,
              url: img.url,
              room: img.room ?? null,
              tags: [],
            });
          }
        }
      }
    } catch (err) {
      console.error("[ProjectImageTagger] project image fetch error:", err);
    }

    // 3. Fall back to the images handed in by the parent.
    if (providedImages?.length) {
      if (imageMap.size === 0) {
        setImages(normalizeImages(providedImages));
        setLoading(false);
        return;
      }
      for (const img of normalizeImages(providedImages)) {
        if (!imageMap.has(img.id)) imageMap.set(img.id, img);
      }
    }

    setImages(Array.from(imageMap.values()));
    setLoading(false);
  }, [projectId, providedImages]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Background BQL rung for flagged hard domains: kick the dedicated route, then
  // poll the product until its scrapeStatus leaves 'pending', refreshing the
  // tags so the filled product replaces the pending stub.
  const runBqlScrape = useCallback(
    (productId: string) => {
      setScrapingIds((prev) => new Set(prev).add(productId));
      setBannerDismissed(false);

      const clear = () =>
        setScrapingIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });

      // Kick the rung. Completion is observed via the poll below, not by awaiting.
      fetch(`/api/products/${productId}/scrape-bql`, { method: "POST" }).catch(() => {});

      const deadline = Date.now() + 130000;
      const poll = async () => {
        try {
          const r = await fetch(`/api/products/${productId}`);
          if (r.ok) {
            const d = await r.json();
            if (d.scrapeStatus && d.scrapeStatus !== "pending") {
              // Highlight what the stealth scrape couldn't recover.
              const missing =
                d.scrapeStatus === "failed"
                  ? ["details"]
                  : [
                      !d.imageUrl && "image",
                      d.price == null && "price",
                      !d.description && "description",
                    ].filter(Boolean as any as (x: unknown) => x is string);
              setReviewFlags((prev) => {
                if (missing.length === 0) {
                  if (!(productId in prev)) return prev;
                  const next = { ...prev };
                  delete next[productId];
                  return next;
                }
                return { ...prev, [productId]: missing };
              });
              clear();
              await fetchImages();
              return;
            }
          }
        } catch {
          /* transient; keep polling until the deadline */
        }
        if (Date.now() < deadline) {
          setTimeout(poll, 3000);
        } else {
          clear();
          await fetchImages();
        }
      };
      setTimeout(poll, 3000);
    },
    [fetchImages],
  );

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    // Don't place a new tag if we just finished dragging
    if (justFinishedDrag.current) return;
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingDot({ x, y });
    setShowProductSearch(true);
  };

  const closeProductPicker = () => {
    setShowProductSearch(false);
    setPendingDot(null);
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tag-product-to-image?id=${tagId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchImages();
      }
    } catch (err) {
      console.error("[ProjectImageTagger] delete error:", err);
    }
  };

  // Confirm a tag — marks it reviewed so it leaves the review queue and its
  // pin turns from amber back to normal. Optimistically updates local state.
  const confirmTag = async (tagId: string) => {
    try {
      const res = await fetch("/api/tag-product-to-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tagId, reviewed: true }),
      });
      if (!res.ok) return;
      const now = new Date().toISOString();
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          tags: img.tags.map((t) => (t.id === tagId ? { ...t, reviewedAt: now } : t)),
        })),
      );
    } catch {
      /* best-effort */
    }
  };

  // Tags awaiting review: their product went through a deferred scrape
  // (scrapeStatus set) and the designer hasn't confirmed them yet.
  const pendingTags = images.flatMap((img) =>
    img.tags
      .filter((t) => t.product?.scrapeStatus != null && !t.reviewedAt)
      .map((t) => ({
        tagId: t.id,
        productId: t.productId,
        imageId: img.id,
        name: t.product?.name ?? "Product",
        productImageUrl: t.product?.imageUrl ?? null,
        fetching: scrapingIds.has(t.productId),
      })),
  );

  // Leaving the tagger with tags still awaiting review drops an inbox reminder.
  const handleClose = useCallback(async () => {
    if (pendingTags.length > 0) {
      try {
        await fetch("/api/notifications/tag-review-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
      } catch {
        /* best-effort — don't block closing */
      }
    }
    onClose();
  }, [pendingTags.length, projectId, onClose]);

  // --- Drag-to-reposition handlers ---
  const handleDragStart = useCallback((tagId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDidMove.current = false;
    setDraggingTagId(tagId);
    setHoveredTagId(null);

    const tag = activeImage?.tags.find(t => t.id === tagId);
    if (tag) {
      const xPct = tag.x <= 1 ? tag.x * 100 : tag.x;
      const yPct = tag.y <= 1 ? tag.y * 100 : tag.y;
      setDragPos({ x: xPct, y: yPct });
    }
  }, [activeImage]);

  const getDragPosition = useCallback((clientX: number, clientY: number) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handleDragSave = useCallback(async (tagId: string, x: number, y: number) => {
    try {
      const res = await fetch("/api/tag-product-to-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tagId, x, y }),
      });
      if (res.ok) {
        await fetchImages();
      }
    } catch (err) {
      console.error("[ProjectImageTagger] drag save error:", err);
      await fetchImages(); // revert to server state on error
    }
  }, [fetchImages]);

  useEffect(() => {
    if (!draggingTagId) return;

    const handleMouseMove = (e: MouseEvent) => {
      dragDidMove.current = true;
      const pos = getDragPosition(e.clientX, e.clientY);
      if (pos) setDragPos(pos);
    };

    const handleTouchMove = (e: TouchEvent) => {
      dragDidMove.current = true;
      const touch = e.touches[0];
      if (!touch) return;
      const pos = getDragPosition(touch.clientX, touch.clientY);
      if (pos) setDragPos(pos);
    };

    const handleEnd = () => {
      if (dragDidMove.current && dragPos) {
        handleDragSave(draggingTagId, dragPos.x, dragPos.y);
        // Suppress the next image click so dropping doesn't create a new tag
        justFinishedDrag.current = true;
        setTimeout(() => { justFinishedDrag.current = false; }, 200);
      }
      setDraggingTagId(null);
      setDragPos(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [draggingTagId, dragPos, getDragPosition, handleDragSave]);

  // Keep activeImage in sync after fetchImages
  useEffect(() => {
    if (activeImage) {
      const updated = images.find((img) => img.id === activeImage.id);
      if (updated) setActiveImage(updated);
    }
  }, [images]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="ridge-card p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="folio-body text-folio-text-secondary">Loading images...</p>
        </div>
      </div>
    );
  }

  // No images found
  if (images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="ridge-card p-8 max-w-sm text-center">
          <FaTag className="w-10 h-10 mx-auto mb-3 text-folio-text-tertiary" />
          <h3 className="folio-h3 text-folio-text-primary mb-2">No Images Found</h3>
          <p className="folio-body text-folio-text-secondary mb-4">
            Upload images to your project before tagging products.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-canvas border-b border-folio-border-subtle">
        <div className="flex items-center gap-3">
          <FaTag className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="folio-ui text-folio-text-primary">
            {activeImage ? "Click to place a tag · Drag to reposition" : "Select an image to tag"}
          </h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 text-folio-text-secondary hover:text-folio-text-primary transition-colors"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </div>

      {/* Async scrape banner: shown while deferred scrapes run in the background */}
      {scrapingIds.size > 0 && !bannerDismissed && (
        <div className="flex items-center gap-3 px-6 py-3 bg-[var(--accent)]/5 border-b border-[var(--accent)]/20">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--accent)] animate-pulse" />
          <p className="folio-meta flex-1 text-folio-text-secondary">
            Fetching full product details in the background — keep tagging. We&apos;ll flag each tag below
            when it&apos;s ready to review, and message your inbox if you leave first.
          </p>
          <button
            onClick={() => setBannerDismissed(true)}
            className="flex-shrink-0 text-folio-text-tertiary hover:text-folio-text-primary"
            title="Dismiss"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending-review panel: tags whose scrape finished but aren't confirmed */}
      {pendingTags.length > 0 && (
        <div className="border-b border-folio-border-subtle bg-surface-ground/50 px-6 py-3">
          <div className="mb-2 flex items-center gap-2">
            <FaExclamationCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="folio-meta font-medium text-folio-text-primary">
              {pendingTags.length} tag{pendingTags.length !== 1 ? "s" : ""} awaiting review
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pendingTags.map((p) => (
              <div
                key={p.tagId}
                role="button"
                tabIndex={0}
                onClick={() => setEditState({ productId: p.productId, tagId: p.tagId })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditState({ productId: p.productId, tagId: p.tagId });
                  }
                }}
                title="Click to review & edit"
                className="group flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-folio-border-subtle bg-surface-card px-2 py-1.5 text-left transition-colors hover:border-[var(--accent)] hover:bg-surface-ground focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {p.productImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.productImageUrl} alt="" className="h-8 w-8 rounded object-cover bg-surface-ground" />
                ) : (
                  <div className="h-8 w-8 rounded bg-surface-ground" />
                )}
                <div className="min-w-0 max-w-[140px]">
                  <span className="block truncate text-xs font-medium text-folio-text-primary" title={p.name}>
                    {p.name}
                  </span>
                  <span className={`text-[var(--type-fine)] ${p.fetching ? "text-[var(--accent)]" : "text-amber-600"}`}>
                    {p.fetching ? "Fetching…" : "Ready · click to edit"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!p.fetching && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmTag(p.tagId);
                      }}
                      title="Confirm tag"
                      className="flex h-6 w-6 items-center justify-center rounded bg-[var(--accent)] text-white hover:opacity-90"
                    >
                      <FaCheck className="w-2.5 h-2.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTag(p.tagId);
                    }}
                    title="Discard tag"
                    className="flex h-6 w-6 items-center justify-center rounded text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <FaTrash className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!activeImage ? (
          /* Image Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setActiveImage(img)}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden ring-1 ring-[var(--ridge-outer)] hover:ring-[var(--accent)] transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                {img.tags.length > 0 && (
                  <div className="absolute top-2 right-2 bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">
                    {img.tags.length} tag{img.tags.length !== 1 ? "s" : ""}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1.5 rounded-full text-sm font-medium text-folio-text-primary transition-opacity">
                    Tag Products
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Active Image Tagger */
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => {
                setActiveImage(null);
                setPendingDot(null);
                setShowProductSearch(false);
              }}
              className="mb-4 folio-meta text-[var(--accent)] hover:underline"
            >
              &larr; Back to all images
            </button>

            <div className="relative inline-block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={activeImage.url}
                alt=""
                className="w-full rounded-xl cursor-crosshair"
                onClick={handleImageClick}
              />

              {/* Existing tag dots — draggable */}
              {activeImage.tags.map((tag) => {
                const isDragging = draggingTagId === tag.id;
                // Only an active in-session poll counts as "scraping".
                const isScraping = scrapingIds.has(tag.productId);
                const reviewMissing = !isScraping ? reviewFlags[tag.productId] : undefined;
                const needsReview = !isScraping && tag.product?.scrapeStatus != null && !tag.reviewedAt;
                const xPct = isDragging && dragPos ? dragPos.x : (tag.x <= 1 ? tag.x * 100 : tag.x);
                const yPct = isDragging && dragPos ? dragPos.y : (tag.y <= 1 ? tag.y * 100 : tag.y);
                return (
                  <div
                    key={tag.id}
                    className={`absolute z-10 pointer-events-auto ${isDragging ? "z-30" : ""}`}
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: "translate(-50%, -50%)",
                      cursor: isDragging ? "grabbing" : "grab",
                    }}
                    onMouseDown={(e) => handleDragStart(tag.id, e)}
                    onTouchStart={(e) => handleDragStart(tag.id, e)}
                    onMouseEnter={() => { if (!draggingTagId) showTag(tag.id); }}
                    onMouseLeave={scheduleHideTag}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${needsReview ? "bg-amber-500" : "bg-[var(--accent)]"} ${isDragging ? "scale-125" : ""} ${isScraping ? "animate-pulse" : ""}`}>
                      {needsReview ? (
                        <FaExclamationCircle className="w-2.5 h-2.5 text-white" />
                      ) : (
                        <FaTag className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>

                    {hoveredTagId === tag.id && !isDragging && (
                      <div
                        className="absolute left-1/2 bottom-full -translate-x-1/2 pb-2 z-20"
                        onMouseEnter={() => showTag(tag.id)}
                        onMouseLeave={scheduleHideTag}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditState({ productId: tag.productId, tagId: tag.id });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setEditState({ productId: tag.productId, tagId: tag.id });
                            }
                          }}
                          title="Click to review & edit"
                          className="w-max max-w-[220px] ridge-card px-3 py-2 shadow-lg flex items-center gap-2 cursor-pointer transition-shadow hover:ring-1 hover:ring-[var(--accent)]"
                        >
                          {tag.product?.imageUrl && (
                            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-surface-ground">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={tag.product.imageUrl} alt="" className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium truncate text-folio-text-primary">
                              {tag.product?.name ?? "Product"}
                            </span>
                            {isScraping ? (
                              <span className="text-[var(--type-fine)] text-[var(--accent)] truncate">
                                Fetching details…
                              </span>
                            ) : needsReview ? (
                              <span className="text-[var(--type-fine)] text-amber-600 truncate">
                                {reviewMissing?.length ? `Needs review: ${reviewMissing.join(", ")}` : "Ready to review"}
                              </span>
                            ) : (
                              <span className="text-[var(--type-fine)] text-folio-text-secondary truncate">
                                {tag.product?.brand || "Click to edit"}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.id);
                            }}
                            className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Discard tag"
                          >
                            <FaTrash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pending dot */}
              {pendingDot && (
                <div
                  className="absolute z-10"
                  style={{
                    left: `${pendingDot.x}%`,
                    top: `${pendingDot.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-lg animate-pulse">
                    <FaTag className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Tag count */}
            {activeImage.tags.length > 0 && (
              <p className="mt-3 folio-meta text-folio-text-secondary">
                {activeImage.tags.length} product{activeImage.tags.length !== 1 ? "s" : ""} tagged
              </p>
            )}
          </div>
        )}
      </div>

      {/* Product picker — the search / URL-paste / write panel (shared). */}
      {showProductSearch && pendingDot && activeImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={closeProductPicker}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <ProductTagPicker
              projectId={projectId}
              imageId={activeImage.id}
              pendingDot={pendingDot}
              onCancel={closeProductPicker}
              onTagged={async ({ productId, deferred, openEdit }) => {
                closeProductPicker();
                await fetchImages();
                if (deferred) runBqlScrape(productId);
                if (openEdit) setEditState({ productId, tagId: null });
              }}
            />
          </div>
        </div>
      )}

      {/* Edit-an-existing-tagged-product modal (shared). */}
      {editState && (
        <ProductEditModal
          productId={editState.productId}
          tagId={editState.tagId}
          onClose={() => setEditState(null)}
          onSaved={async (tagId) => {
            // A human confirmed the details — clear any "needs review" flag.
            setReviewFlags((prev) => {
              if (!editState || !(editState.productId in prev)) return prev;
              const next = { ...prev };
              delete next[editState.productId];
              return next;
            });
            // Editing from the review queue counts as confirming the tag.
            if (tagId) await confirmTag(tagId);
            await fetchImages();
          }}
        />
      )}
    </div>
  );
}
