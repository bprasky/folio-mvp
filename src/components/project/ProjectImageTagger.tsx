"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FaTimes, FaTag, FaSearch, FaCheck, FaTrash, FaGripLines } from "react-icons/fa";

type ImageWithTags = {
  id: string;
  url: string;
  room: string | null;
  tags: Array<{
    id: string;
    x: number;
    y: number;
    productId: string;
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      brand: string | null;
    } | null;
  }>;
};

type SearchProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  vendorName: string | null;
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
    product?: {
      id: string;
      name: string;
      imageUrl?: string | null;
      brand?: string | null;
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
      product: t.product
        ? {
            id: t.product.id,
            name: t.product.name,
            imageUrl: t.product.imageUrl ?? null,
            brand: t.product.brand ?? null,
          }
        : null,
    })),
  }));
}

/**
 * ProjectImageTagger — a modal-style UI for manually tagging products on
 * project images. Shows all project images, lets the designer pick one,
 * click to place a dot, then search/select a product.
 */
export function ProjectImageTagger({ projectId, images: providedImages, onClose }: Props) {
  const [images, setImages] = useState<ImageWithTags[]>(() =>
    providedImages ? normalizeImages(providedImages) : []
  );
  const [loading, setLoading] = useState(!providedImages);
  const [activeImage, setActiveImage] = useState<ImageWithTags | null>(null);

  // Tagging state
  const [pendingDot, setPendingDot] = useState<{ x: number; y: number } | null>(null);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);

  // "Paste a link" mode — scrape a product URL, then tag it at the dot.
  const [tagMode, setTagMode] = useState<"search" | "url">("search");
  const [productUrl, setProductUrl] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlPreview, setUrlPreview] = useState<{
    name: string;
    imageUrl: string | null;
    price: string | null;
    brand: string | null;
    url: string;
  } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state — refs to avoid re-renders during drag
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragDidMove = useRef(false);
  const justFinishedDrag = useRef(false);

  const fetchImages = useCallback(async () => {
    const imageMap = new Map<string, ImageWithTags>();

    // 1. Existing tags. Best-effort: a failure here must not hide the
    //    project's untagged photos (the previous version threw and left the
    //    tagger showing "no photos" whenever this call hiccuped).
    try {
      const res = await fetch(
        `/api/tag-product-to-image?projectId=${projectId}`
      );
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

    // 3. Fall back to the images handed in by the parent. This is the same
    //    list the project page renders, so the tagger can never report "no
    //    photos" for images the user can plainly see — even if the fetch
    //    endpoints above return nothing (e.g. a brand-new, untagged project).
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

  // Debounced product search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchTerm)}&limit=12`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchTerm]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    // Don't place a new tag if we just finished dragging
    if (justFinishedDrag.current) return;
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingDot({ x, y });
    setShowProductSearch(true);
    setSearchTerm("");
    setSelectedProduct(null);
    setTagMode("search");
    setProductUrl("");
    setUrlPreview(null);
    setUrlError(null);
  };

  const closeProductPicker = () => {
    setShowProductSearch(false);
    setPendingDot(null);
    setSelectedProduct(null);
    setTagMode("search");
    setProductUrl("");
    setUrlPreview(null);
    setUrlError(null);
  };

  // Scrape a product URL into a preview the designer can confirm before tagging.
  const handleFetchUrl = async () => {
    const url = productUrl.trim();
    if (!url) return;
    setUrlFetching(true);
    setUrlError(null);
    setUrlPreview(null);
    try {
      const res = await fetch("/api/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUrlError(data.error || "Could not read that link.");
        return;
      }
      setUrlPreview({
        name: data.name || "Untitled product",
        imageUrl: data.image || data.imageUrl || null,
        price: data.price || null,
        brand: data.brand || null,
        url,
      });
    } catch {
      setUrlError("Could not read that link.");
    } finally {
      setUrlFetching(false);
    }
  };

  const handleSaveTag = async () => {
    if (!pendingDot || !activeImage) return;
    if (tagMode === "search" && !selectedProduct) return;
    if (tagMode === "url" && !urlPreview) return;
    setSaving(true);
    try {
      // In URL mode, create the product from the scraped preview first. It
      // lands as a pending stub awaiting vendor claim.
      let productId: string;
      if (tagMode === "url" && urlPreview) {
        const priceNum = parseFloat(
          String(urlPreview.price ?? "").replace(/[^0-9.]/g, ""),
        );
        const createRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: urlPreview.name,
            imageUrl: urlPreview.imageUrl,
            price: Number.isFinite(priceNum) ? priceNum : undefined,
            brand: urlPreview.brand,
            url: urlPreview.url,
            isPending: true,
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok || !created.id) {
          throw new Error(created.error || "Failed to create product");
        }
        productId = created.id;
      } else {
        productId = selectedProduct!.id;
      }

      const res = await fetch("/api/tag-product-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: pendingDot.x,
          y: pendingDot.y,
          productId,
          imageId: activeImage.id,
          projectId,
        }),
      });
      if (res.ok) {
        closeProductPicker();
        // Refresh image data — the useEffect watching `images` will
        // re-sync activeImage on the next render, so no need to do it here.
        await fetchImages();
      }
    } catch (err) {
      console.error("[ProjectImageTagger] save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tag-product-to-image?id=${tagId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchImages();
      }
    } catch (err) {
      console.error("[ProjectImageTagger] delete error:", err);
    }
  };

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
            {activeImage ? "Click to place a tag \u00B7 Drag to reposition" : "Select an image to tag"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-folio-text-secondary hover:text-folio-text-primary transition-colors"
        >
          <FaTimes className="w-5 h-5" />
        </button>
      </div>

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
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
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
                    onMouseEnter={() => { if (!draggingTagId) setHoveredTagId(tag.id); }}
                    onMouseLeave={() => setHoveredTagId(null)}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-lg transition-transform ${isDragging ? "scale-125" : ""}`}>
                      <FaTag className="w-2.5 h-2.5 text-white" />
                    </div>

                    {hoveredTagId === tag.id && !isDragging && (
                      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-max max-w-[220px] ridge-card px-3 py-2 shadow-lg z-20">
                        <div className="flex items-center gap-2">
                          {tag.product?.imageUrl && (
                            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-surface-ground">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={tag.product.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium truncate text-folio-text-primary">
                              {tag.product?.name ?? "Product"}
                            </span>
                            {tag.product?.brand && (
                              <span className="text-[var(--type-fine)] text-folio-text-secondary truncate">
                                {tag.product.brand}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.id);
                            }}
                            className="ml-auto p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="Remove tag"
                          >
                            <FaTrash className="w-2.5 h-2.5" />
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

      {/* Product Search Modal */}
      {showProductSearch && pendingDot && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div
            className="ridge-card w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-folio-border-subtle">
              <div>
                <h3 className="folio-ui text-folio-text-primary">Select Product</h3>
                <p className="folio-meta text-folio-text-tertiary">
                  Position: {pendingDot.x.toFixed(1)}%, {pendingDot.y.toFixed(1)}%
                </p>
              </div>
              <button
                onClick={closeProductPicker}
                className="text-folio-text-secondary hover:text-folio-text-primary"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {/* Mode toggle — search the catalog, or paste a product link */}
            <div className="px-5 pt-3">
              <div className="inline-flex rounded-lg bg-surface-ground p-1 text-sm">
                <button
                  onClick={() => setTagMode("search")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    tagMode === "search"
                      ? "bg-surface-canvas text-folio-text-primary shadow-sm"
                      : "text-folio-text-secondary hover:text-folio-text-primary"
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setTagMode("url")}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    tagMode === "url"
                      ? "bg-surface-canvas text-folio-text-primary shadow-sm"
                      : "text-folio-text-secondary hover:text-folio-text-primary"
                  }`}
                >
                  Paste a link
                </button>
              </div>
            </div>

            {/* Search input */}
            {tagMode === "search" && (
              <div className="px-5 py-3 border-b border-folio-border-subtle">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-folio-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 ridge-input text-sm"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Paste-a-link panel */}
            {tagMode === "url" && (
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://vendor.com/product"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFetchUrl();
                    }}
                    className="flex-1 px-3 py-2 ridge-input text-sm"
                    autoFocus
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={urlFetching || !productUrl.trim()}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    {urlFetching ? "Reading…" : "Fetch"}
                  </button>
                </div>

                {urlError && (
                  <p className="folio-meta text-red-500">{urlError}</p>
                )}

                {!urlPreview && !urlFetching && !urlError && (
                  <p className="text-center folio-meta text-folio-text-tertiary py-4">
                    Paste a product link and we&apos;ll pull the details.
                  </p>
                )}

                {urlPreview && (
                  <div className="flex items-center gap-3 p-3 rounded-lg ring-2 ring-[var(--accent)] bg-[var(--accent)]/5">
                    {urlPreview.imageUrl && (
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-ground">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={urlPreview.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-folio-text-primary truncate">
                        {urlPreview.name}
                      </div>
                      <div className="text-xs text-folio-text-secondary truncate">
                        {[urlPreview.brand, urlPreview.price]
                          .filter(Boolean)
                          .join(" · ") || "New product"}
                      </div>
                    </div>
                    <FaCheck className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {tagMode === "search" && (
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {searching && (
                <p className="text-center folio-meta text-folio-text-tertiary py-4">
                  Searching...
                </p>
              )}
              {!searching && searchResults.length === 0 && searchTerm.trim() && (
                <p className="text-center folio-meta text-folio-text-tertiary py-4">
                  No products found. Try a different search.
                </p>
              )}
              {!searching && !searchTerm.trim() && (
                <p className="text-center folio-meta text-folio-text-tertiary py-4">
                  Type to search for a product
                </p>
              )}
              <div className="space-y-2">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                      selectedProduct?.id === product.id
                        ? "ring-2 ring-[var(--accent)] bg-[var(--accent)]/5"
                        : "hover:bg-surface-ground"
                    }`}
                  >
                    {product.imageUrl && (
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-ground">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-folio-text-primary truncate">
                        {product.name}
                      </div>
                      {product.vendorName && (
                        <div className="text-xs text-folio-text-secondary truncate">
                          {product.vendorName}
                        </div>
                      )}
                    </div>
                    {selectedProduct?.id === product.id && (
                      <FaCheck className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-folio-border-subtle">
              <button
                onClick={closeProductPicker}
                className="flex-1 px-4 py-2 ridge-card text-sm font-medium text-folio-text-primary hover:bg-surface-ground transition-colors text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTag}
                disabled={
                  saving || (tagMode === "search" ? !selectedProduct : !urlPreview)
                }
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FaCheck className="w-3 h-3" />
                    Tag Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
