"use client";

import { useEffect, useState, useRef } from "react";
import {
  FaTimes,
  FaSearch,
  FaCheck,
  FaImage,
  FaExternalLinkAlt,
  FaChevronDown,
  FaChevronUp,
  FaExclamationCircle,
} from "react-icons/fa";
import { isFlaggedDomain } from "@/lib/browserless/flaggedDomains";
import { composeDescription, splitList, renderPreviewField } from "./productFields";

type SearchProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  vendorName: string | null;
};

/** Result handed back after a tag is written, so the caller can refresh + follow up. */
export type TaggedResult = {
  productId: string;
  /** Flagged/hard domain — product tagged pending; the caller kicks the BQL rung. */
  deferred: boolean;
  /** Reused an existing product that needs completing — caller may open the editor. */
  openEdit?: boolean;
};

type Props = {
  projectId: string;
  imageId: string;
  /** The transient placed pin, in 0–100 percent coordinates. */
  pendingDot: { x: number; y: number };
  onCancel: () => void;
  /**
   * Fired after the tag write succeeds. The caller owns closing the picker,
   * refreshing its image list, kicking any deferred scrape, and (optionally)
   * opening the product editor.
   */
  onTagged: (result: TaggedResult) => void | Promise<void>;
};

/**
 * ProductTagPicker — the product search / URL-paste / manual-capture panel and
 * the write to `POST /api/tag-product-to-image`, lifted out of
 * ProjectImageTagger so the modal and the inline MediaSection surface share one
 * implementation. Renders the card body only; the caller supplies the chrome
 * (modal backdrop vs. inline column).
 */
export function ProductTagPicker({ projectId, imageId, pendingDot, onCancel, onTagged }: Props) {
  const [tagMode, setTagMode] = useState<"search" | "url">("search");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [saving, setSaving] = useState(false);
  // Finish capture (spec 21 delta D3). Extraction proposes; the designer
  // confirms. `finishTouched` is the whole point — a value the designer never
  // looked at is a proposal, not a statement, and Material Study depends on
  // being able to tell those apart later.
  const [finish, setFinish] = useState("");
  const [finishTouched, setFinishTouched] = useState(false);
  // The catalog prefill is async, so it must check whether the designer started
  // typing while it was in flight — a stale closure would overwrite them.
  const finishTouchedRef = useRef(false);

  // "Paste a link" mode — scrape a product URL, then tag it at the dot.
  const [productUrl, setProductUrl] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlPreview, setUrlPreview] = useState<{
    name: string;
    imageUrl: string | null;
    price: string | null;
    brand: string | null;
    url: string;
    description?: string | null;
    category?: string | null;
    dimensions?: string | null;
    materials?: string[];
    colors?: string[];
    /** Finish as the vendor states it, from the JSON-LD/AI extraction (spec 21 D3). */
    finish?: string | null;
    /** Set only when Tier 3 (AI) ran — flags a low-confidence scrape to verify. */
    confidence?: string | null;
    /** Flagged hard domain: skip the inline scrape, fill via the BQL rung after tagging. */
    deferred?: boolean;
  } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Guided manual capture — fallback when a retailer blocks the scraper.
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<{ name: string; brand: string; price: string; imageUrl: string | null; description: string }>(
    { name: "", brand: "", price: "", imageUrl: null, description: "" },
  );
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState<null | "text" | "image">(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Dedup: when a pasted URL already maps to an existing product, offer to reuse it.
  const [existingMatch, setExistingMatch] = useState<null | {
    id: string;
    name: string | null;
    imageUrl: string | null;
    price: number | null;
    brand: string | null;
    claimed: boolean;
    complete: boolean;
    flags: { field: string; severity: "missing" | "suspicious"; message: string }[];
  }>(null);
  const [lookupChecked, setLookupChecked] = useState(false);
  const [reusing, setReusing] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}&limit=12`);
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

  // Scrape a product URL into a preview the designer can confirm before tagging.
  const handleFetchUrl = async () => {
    const url = productUrl.trim();
    if (!url) return;
    setPreviewExpanded(false);
    setExistingMatch(null);

    // Dedup first: reuse an existing product for this URL rather than duplicating.
    if (!lookupChecked) {
      try {
        const r = await fetch(`/api/products/lookup?url=${encodeURIComponent(url)}`);
        if (r.ok) {
          const d = await r.json();
          if (d?.match) {
            setExistingMatch(d.match);
            setUrlError(null);
            setUrlPreview(null);
            setShowManual(false);
            return;
          }
        }
      } catch {
        /* fall through to a normal scrape */
      }
    }

    // Flagged hard domains block the cheap tiers; defer to the background BQL rung.
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
      // The cheap path detected a bot wall and is handing off to the stealth rung.
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
        finish: data.finish || null,
        category: data.category || null,
        dimensions: data.dimensions || null,
        materials: Array.isArray(data.materials) ? data.materials : [],
        colors: Array.isArray(data.colors) ? data.colors : [],
        confidence: data.confidence || null,
      });
      setPreviewExpanded(true);
    } catch {
      setUrlError("Could not read that link.");
      setShowManual(true);
    } finally {
      setUrlFetching(false);
    }
  };

  // Patch a field on the live scrape preview (the confirm panel edits in place).
  // Prefill the finish from extraction when a URL preview arrives. Never
  // overwrites what the designer typed: a proposal that clobbers a statement is
  // worse than no proposal at all.
  useEffect(() => {
    if (finishTouched) return;
    setFinish(urlPreview?.finish?.trim() ?? "");
  }, [urlPreview?.finish, finishTouched]);

  // Same prefill for a catalog selection, which has no scrape to read it from.
  // Ignores a stale response if the designer moves on before it lands, and
  // still never overwrites something they typed in the meantime.
  useEffect(() => {
    const id = selectedProduct?.id;
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${id}/finish`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || finishTouchedRef.current) return;
        if (data?.finish) setFinish(String(data.finish));
      } catch {
        // A missing proposal is a blank field, not a failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProduct?.id]);

  const updatePreview = (patch: Partial<NonNullable<typeof urlPreview>>) =>
    setUrlPreview((prev) => (prev ? { ...prev, ...patch } : prev));

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
          imageUrl: manual.imageUrl && !manual.imageUrl.startsWith("data:") ? manual.imageUrl : null,
          price: manual.price,
          brand: manual.brand.trim() || null,
          url: productUrl.trim(),
          description: manual.description.trim() || null,
        }
      : null;

  /**
   * What the tag write says about the finish.
   *
   * `finishConfirmed` is true only when the designer typed or edited the value.
   * A finish that arrived from extraction and was left alone stays unconfirmed
   * even though it is written — that distinction is what lets corpus blocks
   * raise their bar later without a re-capture.
   */
  const finishPayload = () => {
    const value = finish.trim();
    return {
      finishRaw: value || null,
      finishConfirmed: Boolean(value) && finishTouched,
    };
  };

  // Reuse an existing product (a dedup hit) at the pending dot.
  const useExistingProduct = async (forceEdit = false) => {
    if (!existingMatch) return;
    const { id, complete, claimed } = existingMatch;
    setReusing(true);
    try {
      const res = await fetch("/api/tag-product-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: pendingDot.x,
          y: pendingDot.y,
          productId: id,
          imageId,
          projectId,
          ...finishPayload(),
        }),
      });
      if (res.ok) {
        await onTagged({
          productId: id,
          deferred: false,
          openEdit: !claimed && (forceEdit || !complete),
        });
      }
    } catch (err) {
      console.error("[ProductTagPicker] reuse error:", err);
    } finally {
      setReusing(false);
    }
  };

  // "Not the same product" — drop the dedup match and scrape this URL fresh.
  const scrapeFreshInstead = () => {
    setExistingMatch(null);
    setLookupChecked(true);
    handleFetchUrl();
  };

  const saveTag = async () => {
    if (tagMode === "search" && !selectedProduct) return;
    if (tagMode === "url" && !urlModeProduct) return;
    const deferred = tagMode === "url" && urlPreview?.deferred === true;
    setSaving(true);
    try {
      // In URL mode, create the product from the preview/manual capture first.
      let productId: string;
      if (tagMode === "url" && urlModeProduct) {
        const priceNum = parseFloat(String(urlModeProduct.price ?? "").replace(/[^0-9.]/g, ""));
        const createRes = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: urlModeProduct.name?.trim() || urlModeProduct.brand?.trim() || "Untitled product",
            imageUrl: urlModeProduct.imageUrl,
            price: Number.isFinite(priceNum) ? priceNum : undefined,
            brand: urlModeProduct.brand,
            url: urlModeProduct.url,
            category: (urlModeProduct as any).category ?? undefined,
            description:
              composeDescription({
                description: (urlModeProduct as any).description,
                dimensions: (urlModeProduct as any).dimensions,
                materials: (urlModeProduct as any).materials,
                colors: (urlModeProduct as any).colors,
              }) || undefined,
            isPending: true,
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
          imageId,
          projectId,
          ...finishPayload(),
        }),
      });
      if (res.ok) {
        await onTagged({ productId, deferred });
      }
    } catch (err) {
      console.error("[ProductTagPicker] save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ridge-card w-full max-h-[70vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-folio-border-subtle">
        <div>
          <h3 className="folio-ui text-folio-text-primary">Select Product</h3>
          <p className="folio-meta text-folio-text-tertiary">
            Position: {pendingDot.x.toFixed(1)}%, {pendingDot.y.toFixed(1)}%
          </p>
        </div>
        <button onClick={onCancel} className="text-folio-text-secondary hover:text-folio-text-primary">
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

          {/* Dedup hit: we already have this product — reuse it. */}
          {existingMatch && (
            <div className="rounded-lg ring-2 ring-[var(--accent)] bg-[var(--accent)]/5 overflow-hidden">
              <div className="flex items-center gap-2 px-3 pt-3">
                <FaCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="folio-meta font-medium text-folio-text-primary">
                  Already in your catalog · is this it?
                </span>
              </div>
              <div className="flex items-center gap-3 p-3">
                {existingMatch.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={existingMatch.imageUrl}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-lg object-cover bg-surface-ground"
                  />
                ) : (
                  <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-lg bg-surface-ground text-folio-text-tertiary">
                    <FaImage className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-folio-text-primary truncate">
                    {existingMatch.name || "Untitled product"}
                  </div>
                  <div className="text-xs text-folio-text-secondary truncate">
                    {[existingMatch.brand, existingMatch.price != null ? `$${existingMatch.price}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Existing product"}
                  </div>
                  {existingMatch.flags.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {existingMatch.flags.slice(0, 3).map((f, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1 text-[var(--type-fine)] ${
                            f.severity === "suspicious" ? "text-red-500" : "text-amber-600"
                          }`}
                        >
                          <FaExclamationCircle className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{f.message}</span>
                        </div>
                      ))}
                      <div className="text-[var(--type-fine)] text-folio-text-tertiary">
                        You can fix this after tagging.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 border-t border-[var(--accent)]/20 px-3 pt-2.5">
                <button
                  type="button"
                  onClick={scrapeFreshInstead}
                  className="flex-1 rounded-lg py-2 text-sm font-medium text-folio-text-secondary hover:bg-surface-ground transition-colors"
                >
                  Not the same
                </button>
                <button
                  type="button"
                  onClick={() => useExistingProduct(false)}
                  disabled={reusing}
                  className="flex-1 rounded-lg py-2 text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {reusing ? "Tagging…" : "Use this product"}
                </button>
              </div>
              {!existingMatch.claimed && (
                <button
                  type="button"
                  onClick={() => useExistingProduct(true)}
                  disabled={reusing}
                  className="w-full px-3 pb-2.5 pt-1.5 text-center folio-meta text-[var(--accent)] hover:underline disabled:opacity-50"
                >
                  Use it, but the details look wrong — let me fix them
                </button>
              )}
            </div>
          )}

          {urlError && <p className="folio-meta text-red-500">{urlError}</p>}

          {!existingMatch && !urlPreview && !urlFetching && !urlError && !showManual && (
            <p className="text-center folio-meta text-folio-text-tertiary py-4">
              Paste a product link and we&apos;ll pull the details.
            </p>
          )}

          {!existingMatch && !showManual && !urlFetching && !urlPreview && (
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

              {captureError && <p className="folio-meta text-red-500">{captureError}</p>}

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
                      : [urlPreview.brand, urlPreview.price].filter(Boolean).join(" · ") || "New product"}
                  </div>
                </div>
                {!urlPreview.deferred ? (
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded((v) => !v)}
                    className="flex items-center gap-1 text-xs text-folio-text-secondary hover:text-folio-text-primary flex-shrink-0"
                  >
                    {previewExpanded ? "Hide" : "Details"}
                    {previewExpanded ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
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
                    {renderPreviewField("Brand", urlPreview.brand ?? "", (v) => updatePreview({ brand: v }))}
                    {renderPreviewField("Price", urlPreview.price ?? "", (v) => updatePreview({ price: v }))}
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
            <p className="text-center folio-meta text-folio-text-tertiary py-4">Searching...</p>
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
                    <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-folio-text-primary truncate">
                    {product.name}
                  </div>
                  {product.vendorName && (
                    <div className="text-xs text-folio-text-secondary truncate">{product.vendorName}</div>
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

      {/* Finish (spec 21 delta D3). Shown once a product is settled, because
          asking before there is a product to ask about is noise. Optional by
          construction: a designer who does not know the finish moves on, and a
          required field would produce guesses — which is the failure this whole
          design exists to avoid. Free text, no dropdown: a taxonomy authored now
          is wrong at the edges and designers pick the nearest wrong option. */}
      {(selectedProduct || urlModeProduct) && (
        <div className="px-5 pt-4">
          <label htmlFor="tag-finish" className="block text-xs text-folio-text-secondary mb-1.5">
            Finish
          </label>
          <input
            id="tag-finish"
            type="text"
            value={finish}
            onChange={(e) => {
              setFinish(e.target.value);
              setFinishTouched(true);
              finishTouchedRef.current = true;
            }}
            placeholder="Unlacquered brass"
            className="w-full rounded-lg border border-folio-border-subtle bg-surface-canvas px-3 py-2 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          />
          <p className="folio-meta text-folio-text-tertiary mt-1.5">
            {urlPreview?.finish && !finishTouched
              ? "From the product page. Edit it if the specified finish is different."
              : "As the vendor names it. Optional."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 px-5 py-4 border-t border-folio-border-subtle">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 ridge-card text-sm font-medium text-folio-text-primary hover:bg-surface-ground transition-colors text-center"
        >
          Cancel
        </button>
        <button
          onClick={saveTag}
          disabled={saving || (tagMode === "search" ? !selectedProduct : !urlModeProduct)}
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
  );
}
