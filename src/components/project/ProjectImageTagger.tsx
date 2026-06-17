"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { FaTimes, FaTag, FaSearch, FaCheck, FaTrash, FaGripLines, FaImage, FaExternalLinkAlt, FaChevronDown, FaChevronUp, FaExclamationCircle, FaPen } from "react-icons/fa";
import { isFlaggedDomain } from "@/lib/browserless/flaggedDomains";

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
    // Full scraped detail, surfaced in the expandable confirm panel so nothing
    // is hidden. Optional because the deferred (flagged-domain) path has no
    // fields until the background rung fills them.
    description?: string | null;
    category?: string | null;
    dimensions?: string | null;
    materials?: string[];
    colors?: string[];
    /** Set only when Tier 3 (AI) ran — flags a low-confidence scrape to verify. */
    confidence?: string | null;
    /** Flagged hard domain: skip the inline scrape, fill via the BQL rung after tagging. */
    deferred?: boolean;
  } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  // Expandable confirm panel for an inline scrape preview.
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Products currently being filled by the background BQL rung (flagged domains).
  // The tag shows a pending state until the scrape resolves.
  const [scrapingIds, setScrapingIds] = useState<Set<string>>(new Set());
  // Deferred scrapes that finished with gaps: productId -> missing field labels.
  // The tag is highlighted so the designer can see what didn't come through.
  const [reviewFlags, setReviewFlags] = useState<Record<string, string[]>>({});
  // Edit-an-existing-tagged-product modal (designer enrichment of unclaimed
  // products). Null when closed.
  const [editTarget, setEditTarget] = useState<null | {
    id: string;
    name: string;
    brand: string;
    price: string;
    category: string;
    description: string;
    imageUrl: string;
    url: string;
  }>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Tag whose edit modal is open (so saving can also mark it reviewed).
  const [editTagId, setEditTagId] = useState<string | null>(null);
  // Manual autofill inside the edit modal — the rescue path when the deferred
  // scrape returned nothing. The designer pastes the product copy or drops a
  // screenshot; we parse it into the edit fields via the same endpoints the
  // pre-tag manual capture uses.
  const [editPasteText, setEditPasteText] = useState("");
  const [editParsing, setEditParsing] = useState<null | "text" | "image">(null);
  // Dismissible "fetching in the background" banner shown while scrapes run.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Guided manual capture — fallback when a retailer blocks the scraper. The
  // designer pastes the product copy or drops a screenshot; we parse it (and,
  // for screenshots, host the image) into the same preview the URL path yields.
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<{ name: string; brand: string; price: string; imageUrl: string | null; description: string }>(
    { name: "", brand: "", price: "", imageUrl: null, description: "" },
  );
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState<null | "text" | "image">(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state — refs to avoid re-renders during drag
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragDidMove = useRef(false);
  const justFinishedDrag = useRef(false);

  // Keep the hover popup reachable: moving the cursor from the dot up to the
  // popup briefly leaves the dot's hit-area, so hide on a short grace delay that
  // any re-entry (dot or popup) cancels. Without this the popup vanishes before
  // you can click its edit/delete controls.
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

  // Background BQL rung for flagged hard domains: kick the dedicated route, then
  // poll the product until its scrapeStatus leaves 'pending', refreshing the
  // tags so the filled product (name, image, price) replaces the pending stub.
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

      // Kick the rung. It runs inline server-side (~34s) under a raised
      // maxDuration; completion is observed via the poll below, not by awaiting.
      fetch(`/api/products/${productId}/scrape-bql`, { method: "POST" }).catch(() => {});

      const deadline = Date.now() + 130000;
      const poll = async () => {
        try {
          const r = await fetch(`/api/products/${productId}`);
          if (r.ok) {
            const d = await r.json();
            if (d.scrapeStatus && d.scrapeStatus !== "pending") {
              // Highlight what the stealth scrape couldn't recover so the
              // designer can review/fix it after it lands (confirm-after).
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
    setShowManual(false);
    setManual({ name: "", brand: "", price: "", imageUrl: null, description: "" });
    setPasteText("");
    setParsing(null);
    setCaptureError(null);
  };

  // Scrape a product URL into a preview the designer can confirm before tagging.
  const handleFetchUrl = async () => {
    const url = productUrl.trim();
    if (!url) return;
    // Each fetch starts collapsed; only an inline scrape with fields opens it.
    setPreviewExpanded(false);

    // Flagged hard domains (e.g. Wayfair) block the cheap tiers and take ~34s on
    // the BQL rung, too slow to run inline here. Defer: stage a pending preview,
    // tag a pending product on save, then let the scrape-bql route fill it in the
    // background. Mirrors how website import and the analyze step hand slow work
    // to a dedicated route.
    if (isFlaggedDomain(url)) {
      let brand: string | null = null;
      try {
        const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
        brand = host ? host.charAt(0).toUpperCase() + host.slice(1) : null;
      } catch {
        /* keep brand null */
      }
      setUrlError(null);
      setShowManual(false);
      setUrlPreview({
        name: brand ? `${brand} product` : "Product",
        imageUrl: null,
        price: null,
        brand,
        url,
        deferred: true,
      });
      return;
    }

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
      // The cheap path detected a bot wall and is handing off to the stealth
      // rung. Defer exactly like a flagged domain: stage a pending preview so the
      // tag lands immediately and the background BQL rung fills in the details.
      if (res.ok && data?.escalate) {
        setUrlError(null);
        setShowManual(false);
        setUrlPreview({
          name: data.brand ? `${data.brand} product` : "Product",
          imageUrl: null,
          price: null,
          brand: data.brand ?? null,
          url,
          deferred: true,
        });
        return;
      }
      if (!res.ok) {
        setUrlError(data.error || "Could not read that link.");
        // Blocked or unreadable: open guided manual capture instead of dead-ending.
        if (data.blocked || res.status === 422 || res.status === 502) {
          setShowManual(true);
        }
        return;
      }
      setUrlPreview({
        name: data.name && data.name !== "Untitled Product" ? data.name : "",
        imageUrl: data.image || data.imageUrl || null,
        price: data.price || null,
        brand: data.brand || null,
        url,
        description: data.description || null,
        category: data.category || null,
        dimensions: data.dimensions || null,
        materials: Array.isArray(data.materials) ? data.materials : [],
        colors: Array.isArray(data.colors) ? data.colors : [],
        confidence: data.confidence || null,
      });
      // Open the detail panel so every captured field — and any gaps — are
      // visible to confirm, instead of collapsing to a one-line label.
      setPreviewExpanded(true);
    } catch {
      setUrlError("Could not read that link.");
      setShowManual(true);
    } finally {
      setUrlFetching(false);
    }
  };

  // ── Guided manual capture helpers ──

  const composeDescription = (f: {
    description?: string | null;
    dimensions?: string | null;
    materials?: string[];
    colors?: string[];
  }): string => {
    const parts: string[] = [];
    if (f.description) parts.push(f.description);
    if (f.dimensions) parts.push(`Dimensions: ${f.dimensions}`);
    if (f.materials?.length) parts.push(`Materials: ${f.materials.join(", ")}`);
    if (f.colors?.length) parts.push(`Colors: ${f.colors.join(", ")}`);
    return parts.join("\n");
  };

  // Patch a field on the live scrape preview (the confirm panel edits in place).
  const updatePreview = (patch: Partial<NonNullable<typeof urlPreview>>) =>
    setUrlPreview((prev) => (prev ? { ...prev, ...patch } : prev));

  // Comma-separated text <-> string[] for the materials / colors fields.
  const splitList = (v: string) =>
    v.split(",").map((s) => s.trim()).filter(Boolean);

  // One labeled, editable field in the confirm panel. Empty values are
  // highlighted so a designer can see at a glance what the scrape missed.
  const renderPreviewField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    multiline = false,
  ) => {
    const missing = !value.trim();
    const ring = missing
      ? "ring-1 ring-amber-300 bg-amber-50/50"
      : "ring-1 ring-folio-border-subtle bg-white";
    const cls = `w-full rounded-md px-2 py-1.5 text-sm ${ring} focus:outline-none focus:ring-2 focus:ring-[var(--accent)]`;
    return (
      <label className="block">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-folio-text-secondary mb-1">
          {label}
          {missing && <span className="text-amber-600 text-[10px]">• missing</span>}
        </span>
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
        )}
      </label>
    );
  };

  const applyParsed = (f: any, image?: string | null) => {
    setManual((prev) => ({
      name: f?.name ?? prev.name,
      brand: f?.brand ?? prev.brand,
      price: f?.price != null ? String(f.price) : prev.price,
      imageUrl: image ?? prev.imageUrl,
      description: composeDescription(f ?? {}) || prev.description,
    }));
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setParsing("text");
    setCaptureError(null);
    try {
      const res = await fetch("/api/products/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, url: productUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCaptureError(data.error || "Couldn't read that text.");
        return;
      }
      applyParsed(data.fields);
    } catch {
      setCaptureError("Couldn't read that text.");
    } finally {
      setParsing(null);
    }
  };

  const handleScreenshot = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setParsing("image");
    setCaptureError(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      // Show the screenshot immediately while vision runs.
      setManual((prev) => ({ ...prev, imageUrl: prev.imageUrl ?? dataUrl }));
      const res = await fetch("/api/products/parse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, url: productUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCaptureError(data.error || "Couldn't read that screenshot.");
        return;
      }
      applyParsed(data.fields, data.image || null);
    } catch {
      setCaptureError("Couldn't read that screenshot.");
    } finally {
      setParsing(null);
    }
  };

  // The product to save in URL mode: the scraped preview, or the manually
  // captured one (paste/screenshot) when scraping was blocked.
  const urlModeProduct = urlPreview
    ? urlPreview
    : showManual && manual.name.trim()
      ? {
          name: manual.name.trim(),
          // Only persist a hosted URL — never a raw data: URL (screenshot preview).
          imageUrl: manual.imageUrl && !manual.imageUrl.startsWith("data:") ? manual.imageUrl : null,
          price: manual.price,
          brand: manual.brand.trim() || null,
          url: productUrl.trim(),
          description: manual.description.trim() || null,
        }
      : null;

  const handleSaveTag = async () => {
    if (!pendingDot || !activeImage) return;
    if (tagMode === "search" && !selectedProduct) return;
    if (tagMode === "url" && !urlModeProduct) return;
    // Flagged hard domain: the product is tagged immediately in a pending state,
    // then the BQL rung fills it in the background.
    const deferred = tagMode === "url" && urlPreview?.deferred === true;
    setSaving(true);
    try {
      // In URL mode, create the product from the preview/manual capture first.
      // It lands as a pending stub awaiting vendor claim.
      let productId: string;
      if (tagMode === "url" && urlModeProduct) {
        const priceNum = parseFloat(
          String(urlModeProduct.price ?? "").replace(/[^0-9.]/g, ""),
        );
        const createRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Name is required by the create endpoint; fall back so a confirmed
            // scrape with the name field left blank still tags cleanly.
            name: urlModeProduct.name?.trim() || urlModeProduct.brand?.trim() || "Untitled product",
            imageUrl: urlModeProduct.imageUrl,
            price: Number.isFinite(priceNum) ? priceNum : undefined,
            brand: urlModeProduct.brand,
            url: urlModeProduct.url,
            category: (urlModeProduct as any).category ?? undefined,
            // Fold the confirmed dimensions / materials / colors into the
            // description (the Product model has no structured columns for them),
            // matching the manual-capture path.
            description:
              composeDescription({
                description: (urlModeProduct as any).description,
                dimensions: (urlModeProduct as any).dimensions,
                materials: (urlModeProduct as any).materials,
                colors: (urlModeProduct as any).colors,
              }) || undefined,
            isPending: true,
            // Hard domains return immediately as pending; scrape-bql fills them.
            scrapeStatus: deferred ? "pending" : undefined,
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
        // Kick the background rung after the tag lands, then poll until it
        // resolves. Mirrors how ImportWizard kicks analyze and polls.
        if (deferred) runBqlScrape(productId);
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

  // Open the edit modal for an already-tagged product, pre-filled from the
  // current record. Designers can enrich unclaimed products (e.g. fill a
  // dimension the deferred scrape missed); the server rejects edits to a
  // claimed product.
  const openEditProduct = async (productId: string, tagId?: string) => {
    setEditError(null);
    setEditTagId(tagId ?? null);
    setEditPasteText("");
    setEditParsing(null);
    try {
      const r = await fetch(`/api/products/${productId}`);
      if (!r.ok) return;
      const d = await r.json();
      setEditTarget({
        id: productId,
        name: d.name && d.name !== "Untitled product" ? d.name : "",
        brand: d.brand ?? "",
        price: d.price != null ? String(d.price) : "",
        category: d.category ?? "",
        description: d.description ?? "",
        imageUrl: d.imageUrl ?? "",
        url: d.url ?? "",
      });
    } catch {
      /* ignore — modal just won't open */
    }
  };

  const updateEdit = (patch: Partial<NonNullable<typeof editTarget>>) =>
    setEditTarget((prev) => (prev ? { ...prev, ...patch } : prev));

  // Merge a parsed result into the open edit modal. Only fills fields the parse
  // actually returned, so it never blanks a value the designer already typed.
  const applyParsedToEdit = (f: any, image?: string | null) =>
    setEditTarget((prev) =>
      prev
        ? {
            ...prev,
            name: f?.name ?? prev.name,
            brand: f?.brand ?? prev.brand,
            price: f?.price != null ? String(f.price) : prev.price,
            category: f?.category ?? prev.category,
            description: composeDescription(f ?? {}) || prev.description,
            // Only adopt a hosted image URL, never a raw data: URL.
            imageUrl:
              image && !image.startsWith("data:") ? image : prev.imageUrl,
          }
        : prev,
    );

  const handleEditParseText = async () => {
    if (!editPasteText.trim() || !editTarget) return;
    setEditParsing("text");
    setEditError(null);
    try {
      const res = await fetch("/api/products/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editPasteText, url: editTarget.url || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Couldn't read that text.");
        return;
      }
      applyParsedToEdit(data.fields);
    } catch {
      setEditError("Couldn't read that text.");
    } finally {
      setEditParsing(null);
    }
  };

  const handleEditScreenshot = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/") || !editTarget) return;
    setEditParsing("image");
    setEditError(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/products/parse-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, url: editTarget.url || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Couldn't read that screenshot.");
        return;
      }
      applyParsedToEdit(data.fields, data.image || null);
    } catch {
      setEditError("Couldn't read that screenshot.");
    } finally {
      setEditParsing(null);
    }
  };

  const saveEditProduct = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const priceNum = parseFloat(editTarget.price.replace(/[^0-9.]/g, ""));
      const res = await fetch(`/api/products/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTarget.name.trim() || editTarget.brand.trim() || "Untitled product",
          brand: editTarget.brand.trim() || null,
          priceCents: Number.isFinite(priceNum) ? Math.round(priceNum * 100) : null,
          category: editTarget.category.trim() || null,
          description: editTarget.description.trim() || null,
          imageUrl: editTarget.imageUrl.trim() || null,
          url: editTarget.url.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setEditError(
          res.status === 403
            ? "This product has been claimed by its vendor and can no longer be edited here."
            : d.error || "Could not save changes.",
        );
        return;
      }
      // A human confirmed the details — clear any "needs review" flag.
      setReviewFlags((prev) => {
        if (!(editTarget.id in prev)) return prev;
        const next = { ...prev };
        delete next[editTarget.id];
        return next;
      });
      // Editing from the review queue counts as confirming the tag.
      if (editTagId) await confirmTag(editTagId);
      setEditTarget(null);
      setEditTagId(null);
      await fetchImages();
    } catch {
      setEditError("Could not save changes.");
    } finally {
      setEditSaving(false);
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
  //
  // `fetching` reflects only a poll THIS session is actively running
  // (`scrapingIds`) — NOT a bare DB `scrapeStatus === "pending"`. The deferred
  // scrape is fire-and-forget; if its serverless function dies (the designer
  // navigated away or closed the tagger) the row stays `pending` with nobody
  // polling. On reopen that tag is stalled, not fetching, so it must be
  // reviewable/editable instead of stuck behind a perpetual "Fetching…".
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

  // Leaving the tagger with tags still awaiting review drops an inbox reminder
  // so the designer can be pulled back in.
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
            {activeImage ? "Click to place a tag \u00B7 Drag to reposition" : "Select an image to tag"}
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
                className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-folio-border-subtle bg-surface-card px-2 py-1.5"
              >
                {p.productImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.productImageUrl} alt="" className="h-8 w-8 rounded object-cover bg-surface-ground" />
                ) : (
                  <div className="h-8 w-8 rounded bg-surface-ground" />
                )}
                <div className="min-w-0 max-w-[140px]">
                  <button
                    onClick={() => {
                      const img = images.find((i) => i.id === p.imageId);
                      if (img) setActiveImage(img);
                    }}
                    className="block truncate text-left text-xs font-medium text-folio-text-primary hover:underline"
                    title={p.name}
                  >
                    {p.name}
                  </button>
                  <span className={`text-[var(--type-fine)] ${p.fetching ? "text-[var(--accent)]" : "text-amber-600"}`}>
                    {p.fetching ? "Fetching…" : "Ready"}
                  </span>
                </div>
                {/* Edit is always available — even while a scrape is still
                    running — so the designer can fill details by hand at any
                    time. Confirm appears once the (best-effort) scrape isn't
                    actively polling. */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditProduct(p.productId, p.tagId)}
                    title="Edit details"
                    className="flex h-6 w-6 items-center justify-center rounded text-folio-text-tertiary hover:text-[var(--accent)]"
                  >
                    <FaPen className="w-2.5 h-2.5" />
                  </button>
                  {!p.fetching && (
                    <button
                      onClick={() => confirmTag(p.tagId)}
                      title="Confirm tag"
                      className="flex h-6 w-6 items-center justify-center rounded bg-[var(--accent)] text-white hover:opacity-90"
                    >
                      <FaCheck className="w-2.5 h-2.5" />
                    </button>
                  )}
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
                // Only an active in-session poll counts as "scraping". A bare DB
                // `pending` with no live poll is a stalled fire-and-forget — it
                // should read as needs-review (amber + editable), not a spinner.
                const isScraping = scrapingIds.has(tag.productId);
                const reviewMissing = !isScraping ? reviewFlags[tag.productId] : undefined;
                // A deferred-scrape tag (scrapeStatus set) needs review until the
                // designer confirms it (reviewedAt). Drives the amber pin + panel.
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
                        <div className="w-max max-w-[220px] ridge-card px-3 py-2 shadow-lg flex items-center gap-2">
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
                            {isScraping ? (
                              <span className="text-[var(--type-fine)] text-[var(--accent)] truncate">
                                Fetching details…
                              </span>
                            ) : needsReview ? (
                              <span className="text-[var(--type-fine)] text-amber-600 truncate">
                                {reviewMissing?.length ? `Needs review: ${reviewMissing.join(", ")}` : "Ready to review"}
                              </span>
                            ) : (
                              tag.product?.brand && (
                                <span className="text-[var(--type-fine)] text-folio-text-secondary truncate">
                                  {tag.product.brand}
                                </span>
                              )
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditProduct(tag.productId, tag.id);
                            }}
                            className="ml-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-folio-text-tertiary hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                            title="Edit details"
                          >
                            <FaPen className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag.id);
                            }}
                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove tag"
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

                {!urlPreview && !urlFetching && !urlError && !showManual && (
                  <p className="text-center folio-meta text-folio-text-tertiary py-4">
                    Paste a product link and we&apos;ll pull the details.
                  </p>
                )}

                {!showManual && !urlFetching && !urlPreview && (
                  <button
                    type="button"
                    onClick={() => setShowManual(true)}
                    className="folio-meta text-[var(--accent)] hover:underline"
                  >
                    Can&apos;t fetch it? Enter the details manually
                  </button>
                )}

                {showManual && (
                  <div
                    className="rounded-lg border border-folio-border-subtle bg-surface-ground p-3 space-y-3"
                    onPaste={(e) => {
                      const file = Array.from(e.clipboardData?.items || [])
                        .find((it) => it.type.startsWith("image/"))
                        ?.getAsFile();
                      if (file) {
                        e.preventDefault();
                        handleScreenshot(file);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="folio-ui text-folio-text-primary">Capture it manually</span>
                      {productUrl.trim() && (
                        <a
                          href={productUrl.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="folio-meta text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                        >
                          Open page <FaExternalLinkAlt className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Paste specs → autofill */}
                    <div className="space-y-1.5">
                      <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Paste the product name, specs, price… from the page"
                        rows={3}
                        className="w-full px-3 py-2 ridge-input text-sm resize-y"
                      />
                      <button
                        type="button"
                        onClick={handleParseText}
                        disabled={parsing !== null || !pasteText.trim()}
                        className="px-3 py-1.5 rounded-lg bg-surface-canvas border border-folio-border-subtle text-folio-text-primary folio-meta font-medium disabled:opacity-50 hover:bg-surface-ground transition-colors"
                      >
                        {parsing === "text" ? "Reading…" : "Autofill from text"}
                      </button>
                    </div>

                    {/* Screenshot → vision autofill + image */}
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-folio-border-subtle cursor-pointer hover:bg-surface-canvas transition-colors folio-meta text-folio-text-secondary">
                      <FaImage className="w-3.5 h-3.5" />
                      {parsing === "image" ? "Reading screenshot…" : "Upload or paste a screenshot"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handleScreenshot(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {captureError && (
                      <p className="folio-meta text-red-500">{captureError}</p>
                    )}

                    {/* Editable fields — always correctable */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {manual.imageUrl && (
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-canvas">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={manual.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <input
                          type="text"
                          value={manual.name}
                          onChange={(e) => setManual((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Product name *"
                          className="flex-1 px-3 py-2 ridge-input text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manual.brand}
                          onChange={(e) => setManual((p) => ({ ...p, brand: e.target.value }))}
                          placeholder="Brand"
                          className="flex-1 px-3 py-2 ridge-input text-sm"
                        />
                        <input
                          type="text"
                          value={manual.price}
                          onChange={(e) => setManual((p) => ({ ...p, price: e.target.value }))}
                          placeholder="Price"
                          className="w-28 px-3 py-2 ridge-input text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {urlPreview && (
                  <div className="rounded-lg ring-2 ring-[var(--accent)] bg-[var(--accent)]/5 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      {urlPreview.imageUrl ? (
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-ground">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={urlPreview.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        !urlPreview.deferred && (
                          <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-lg bg-surface-ground text-folio-text-tertiary">
                            <FaImage className="w-4 h-4" />
                          </div>
                        )
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-folio-text-primary truncate">
                          {urlPreview.name || "Untitled product"}
                        </div>
                        <div className="text-xs text-folio-text-secondary truncate">
                          {urlPreview.deferred
                            ? "We'll fetch the full details in the background after you tag it."
                            : [urlPreview.brand, urlPreview.price]
                                .filter(Boolean)
                                .join(" · ") || "New product"}
                        </div>
                      </div>
                      {!urlPreview.deferred ? (
                        <button
                          type="button"
                          onClick={() => setPreviewExpanded((v) => !v)}
                          className="flex items-center gap-1 text-xs text-folio-text-secondary hover:text-folio-text-primary flex-shrink-0"
                        >
                          {previewExpanded ? "Hide" : "Details"}
                          {previewExpanded ? (
                            <FaChevronUp className="w-3 h-3" />
                          ) : (
                            <FaChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      ) : (
                        <FaCheck className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                      )}
                    </div>

                    {!urlPreview.deferred && previewExpanded && (
                      <div className="border-t border-[var(--accent)]/20 px-3 py-3 space-y-3">
                        {urlPreview.confidence && (
                          <div className="flex items-start gap-2 rounded-md bg-amber-50 text-amber-700 px-2 py-1.5 text-xs">
                            <FaExclamationCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span>These details were estimated by AI — please verify before tagging.</span>
                          </div>
                        )}
                        {renderPreviewField("Name", urlPreview.name, (v) => updatePreview({ name: v }))}
                        <div className="grid grid-cols-2 gap-3">
                          {renderPreviewField("Brand", urlPreview.brand ?? "", (v) =>
                            updatePreview({ brand: v }),
                          )}
                          {renderPreviewField("Price", urlPreview.price ?? "", (v) =>
                            updatePreview({ price: v }),
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {renderPreviewField("Category", urlPreview.category ?? "", (v) =>
                            updatePreview({ category: v }),
                          )}
                          {renderPreviewField("Dimensions", urlPreview.dimensions ?? "", (v) =>
                            updatePreview({ dimensions: v }),
                          )}
                        </div>
                        {renderPreviewField("Materials", (urlPreview.materials ?? []).join(", "), (v) =>
                          updatePreview({ materials: splitList(v) }),
                        )}
                        {renderPreviewField("Colors", (urlPreview.colors ?? []).join(", "), (v) =>
                          updatePreview({ colors: splitList(v) }),
                        )}
                        {renderPreviewField(
                          "Description",
                          urlPreview.description ?? "",
                          (v) => updatePreview({ description: v }),
                          true,
                        )}
                        {renderPreviewField("Image URL", urlPreview.imageUrl ?? "", (v) =>
                          updatePreview({ imageUrl: v || null }),
                        )}
                      </div>
                    )}
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
                  saving || (tagMode === "search" ? !selectedProduct : !urlModeProduct)
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

      {/* Edit-an-existing-tagged-product modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !editSaving && setEditTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface-card shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-folio-border-subtle">
              <h3 className="text-sm font-semibold text-folio-text-primary">Edit product details</h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-folio-text-tertiary hover:text-folio-text-primary"
                title="Close"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {editError && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 text-red-600 px-2 py-1.5 text-xs">
                  <FaExclamationCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Autofill rescue — when the scrape returned nothing, paste the
                  product copy or drop a screenshot and we fill the fields below. */}
              <div className="rounded-lg border border-folio-border-subtle bg-surface-ground p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="folio-meta font-medium text-folio-text-primary">
                    Autofill from the product page
                  </span>
                  {editTarget.url && (
                    <a
                      href={editTarget.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="folio-meta text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                    >
                      Open page <FaExternalLinkAlt className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <textarea
                  value={editPasteText}
                  onChange={(e) => setEditPasteText(e.target.value)}
                  placeholder="Paste the product name, specs, price… from the page"
                  rows={3}
                  className="w-full px-3 py-2 ridge-input text-sm resize-y"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleEditParseText}
                    disabled={editParsing !== null || !editPasteText.trim()}
                    className="px-3 py-1.5 rounded-lg bg-surface-canvas border border-folio-border-subtle text-folio-text-primary folio-meta font-medium disabled:opacity-50 hover:bg-surface-ground transition-colors"
                  >
                    {editParsing === "text" ? "Reading…" : "Autofill from text"}
                  </button>
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-folio-border-subtle cursor-pointer hover:bg-surface-canvas transition-colors folio-meta text-folio-text-secondary">
                    <FaImage className="w-3.5 h-3.5" />
                    {editParsing === "image" ? "Reading screenshot…" : "Upload a screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handleEditScreenshot(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {renderPreviewField("Name", editTarget.name, (v) => updateEdit({ name: v }))}
              <div className="grid grid-cols-2 gap-3">
                {renderPreviewField("Brand", editTarget.brand, (v) => updateEdit({ brand: v }))}
                {renderPreviewField("Price", editTarget.price, (v) => updateEdit({ price: v }))}
              </div>
              {renderPreviewField("Category", editTarget.category, (v) => updateEdit({ category: v }))}
              {renderPreviewField(
                "Description",
                editTarget.description,
                (v) => updateEdit({ description: v }),
                true,
              )}
              {renderPreviewField("Image URL", editTarget.imageUrl, (v) => updateEdit({ imageUrl: v }))}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-folio-border-subtle">
              <button
                onClick={() => setEditTarget(null)}
                disabled={editSaving}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-folio-text-secondary hover:bg-surface-ground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditProduct}
                disabled={editSaving}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
