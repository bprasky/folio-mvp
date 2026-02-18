"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FaTimes, FaTag, FaSearch, FaCheck, FaTrash } from "react-icons/fa";

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

type Props = {
  projectId: string;
  onClose: () => void;
};

/**
 * ProjectImageTagger — a modal-style UI for manually tagging products on
 * project images. Shows all project images, lets the designer pick one,
 * click to place a dot, then search/select a product.
 */
export function ProjectImageTagger({ projectId, onClose }: Props) {
  const [images, setImages] = useState<ImageWithTags[]>([]);
  const [loading, setLoading] = useState(true);
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tag-product-to-image?projectId=${projectId}`
      );
      if (!res.ok) throw new Error("Failed to fetch tags");
      const tags: any[] = await res.json();

      // Group tags by image
      const imageMap = new Map<string, ImageWithTags>();
      for (const tag of tags) {
        const imgId = tag.imageId ?? tag.image?.id;
        const imgUrl = tag.image?.url;
        if (!imgId || !imgUrl) continue;

        if (!imageMap.has(imgId)) {
          imageMap.set(imgId, {
            id: imgId,
            url: imgUrl,
            room: null,
            tags: [],
          });
        }
        imageMap.get(imgId)!.tags.push({
          id: tag.id,
          x: tag.x,
          y: tag.y,
          productId: tag.productId,
          product: tag.product,
        });
      }

      // Also fetch project images that may have NO tags yet
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

      setImages(Array.from(imageMap.values()));
    } catch (err) {
      console.error("[ProjectImageTagger] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingDot({ x, y });
    setShowProductSearch(true);
    setSearchTerm("");
    setSelectedProduct(null);
  };

  const handleSaveTag = async () => {
    if (!pendingDot || !selectedProduct || !activeImage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tag-product-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: pendingDot.x,
          y: pendingDot.y,
          productId: selectedProduct.id,
          imageId: activeImage.id,
          projectId,
        }),
      });
      if (res.ok) {
        setPendingDot(null);
        setShowProductSearch(false);
        setSelectedProduct(null);
        // Refresh image data
        await fetchImages();
        // Re-select the active image from the refreshed list
        setActiveImage((prev) => {
          if (!prev) return null;
          return images.find((img) => img.id === prev.id) ?? prev;
        });
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
          <p className="folio-body text-[var(--text-secondary)]">Loading images...</p>
        </div>
      </div>
    );
  }

  // No images found
  if (images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="ridge-card p-8 max-w-sm text-center">
          <FaTag className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="folio-h3 text-[var(--text-primary)] mb-2">No Images Found</h3>
          <p className="folio-body text-[var(--text-secondary)] mb-4">
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
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-base)] border-b border-[var(--ridge-outer)]">
        <div className="flex items-center gap-3">
          <FaTag className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="folio-ui text-[var(--text-primary)]">
            {activeImage ? "Click image to place a tag" : "Select an image to tag"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1.5 rounded-full text-sm font-medium text-[var(--text-primary)] transition-opacity">
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

              {/* Existing tag dots */}
              {activeImage.tags.map((tag) => {
                const xPct = tag.x <= 1 ? tag.x * 100 : tag.x;
                const yPct = tag.y <= 1 ? tag.y * 100 : tag.y;
                return (
                  <div
                    key={tag.id}
                    className="absolute z-10 pointer-events-auto"
                    style={{
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onMouseEnter={() => setHoveredTagId(tag.id)}
                    onMouseLeave={() => setHoveredTagId(null)}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-lg">
                      <FaTag className="w-2.5 h-2.5 text-white" />
                    </div>

                    {hoveredTagId === tag.id && (
                      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-max max-w-[220px] ridge-card px-3 py-2 shadow-lg z-20">
                        <div className="flex items-center gap-2">
                          {tag.product?.imageUrl && (
                            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-[var(--bg-elevated)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={tag.product.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium truncate text-[var(--text-primary)]">
                              {tag.product?.name ?? "Product"}
                            </span>
                            {tag.product?.brand && (
                              <span className="text-[10px] text-[var(--text-secondary)] truncate">
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
              <p className="mt-3 folio-meta text-[var(--text-secondary)]">
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ridge-outer)]">
              <div>
                <h3 className="folio-ui text-[var(--text-primary)]">Select Product</h3>
                <p className="folio-meta text-[var(--text-tertiary)]">
                  Position: {pendingDot.x.toFixed(1)}%, {pendingDot.y.toFixed(1)}%
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProductSearch(false);
                  setPendingDot(null);
                }}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {/* Search input */}
            <div className="px-5 py-3 border-b border-[var(--ridge-outer)]">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
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

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {searching && (
                <p className="text-center folio-meta text-[var(--text-tertiary)] py-4">
                  Searching...
                </p>
              )}
              {!searching && searchResults.length === 0 && searchTerm.trim() && (
                <p className="text-center folio-meta text-[var(--text-tertiary)] py-4">
                  No products found. Try a different search.
                </p>
              )}
              {!searching && !searchTerm.trim() && (
                <p className="text-center folio-meta text-[var(--text-tertiary)] py-4">
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
                        : "hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    {product.imageUrl && (
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {product.name}
                      </div>
                      {product.vendorName && (
                        <div className="text-xs text-[var(--text-secondary)] truncate">
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

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-[var(--ridge-outer)]">
              <button
                onClick={() => {
                  setShowProductSearch(false);
                  setPendingDot(null);
                }}
                className="flex-1 px-4 py-2 ridge-card text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTag}
                disabled={!selectedProduct || saving}
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
