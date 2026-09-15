"use client";

import { useEffect, useState } from "react";
import { FaTimes, FaImage, FaExternalLinkAlt, FaExclamationCircle } from "react-icons/fa";
import { assessProductHealth } from "@/lib/products/productHealth";
import { composeDescription, renderPreviewField } from "./productFields";

type EditTarget = {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  description: string;
  imageUrl: string;
  url: string;
};

type Props = {
  productId: string;
  /** When set, a successful save also confirms this tag (handled by the caller). */
  tagId?: string | null;
  onClose: () => void;
  /** Fired after a successful save. Caller refreshes + confirms the tag. */
  onSaved: (tagId: string | null) => void | Promise<void>;
};

/**
 * ProductEditModal — enrich or correct an unclaimed product's details, lifted
 * out of ProjectImageTagger so the modal, the inline tagging surface, and the
 * picker's reuse-with-fix path all share one editor. Self-fetches the product
 * on mount; the server rejects edits to a vendor-claimed product.
 */
export function ProductEditModal({ productId, tagId = null, onClose, onSaved }: Props) {
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editPasteText, setEditPasteText] = useState("");
  const [editParsing, setEditParsing] = useState<null | "text" | "image">(null);
  const [rescraping, setRescraping] = useState(false);

  // Pre-fill from the current record.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/products/${productId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
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
        /* ignore — modal just shows the loading state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const updateEdit = (patch: Partial<EditTarget>) =>
    setEditTarget((prev) => (prev ? { ...prev, ...patch } : prev));

  // Merge a parsed result into the open modal. Only fills fields the parse
  // returned, so it never blanks a value the designer already typed.
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
            imageUrl: image && !image.startsWith("data:") ? image : prev.imageUrl,
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

  // Force a fresh scrape of the product's URL and pull the refreshed fields back.
  const rescrapeProduct = async () => {
    if (!editTarget?.url) return;
    setRescraping(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/products/${editTarget.id}/scrape-bql?force=1`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(d.error || "Couldn't refresh from the web. You can still edit the fields by hand.");
        return;
      }
      const r = await fetch(`/api/products/${editTarget.id}`);
      if (r.ok) {
        const p = await r.json();
        setEditTarget((prev) =>
          prev
            ? {
                ...prev,
                name: p.name && p.name !== "Untitled product" ? p.name : prev.name,
                brand: p.brand ?? prev.brand,
                price: p.price != null ? String(p.price) : prev.price,
                category: p.category ?? prev.category,
                description: p.description ?? prev.description,
                imageUrl: p.imageUrl ?? prev.imageUrl,
              }
            : prev,
        );
      }
    } catch {
      setEditError("Couldn't refresh from the web. You can still edit the fields by hand.");
    } finally {
      setRescraping(false);
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
      await onSaved(tagId);
      onClose();
    } catch {
      setEditError("Could not save changes.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !editSaving && onClose()}
    >
      <div
        className="ridge-card w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-folio-border-subtle">
          <h3 className="folio-ui text-folio-text-primary">Edit product details</h3>
          <button
            onClick={onClose}
            className="text-folio-text-tertiary hover:text-folio-text-primary"
            title="Close"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {!editTarget ? (
          <div className="px-5 py-10 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="folio-meta text-folio-text-secondary">Loading product…</p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 px-5 py-4 space-y-3 overflow-y-auto">
              {editError && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 text-red-600 px-2 py-1.5 text-xs">
                  <FaExclamationCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Live health flags — what looks off about this record right now. */}
              {(() => {
                const h = assessProductHealth({
                  name: editTarget.name,
                  brand: editTarget.brand,
                  price: editTarget.price,
                  imageUrl: editTarget.imageUrl,
                  description: editTarget.description,
                });
                if (h.flags.length === 0) return null;
                return (
                  <div className="rounded-md bg-amber-50 px-2.5 py-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-[length:var(--type-eyebrow)] font-medium text-amber-700">
                      <FaExclamationCircle className="w-3 h-3" />
                      This product&apos;s details look incomplete or off:
                    </div>
                    {h.flags.map((f, i) => (
                      <div
                        key={i}
                        className={`pl-4.5 text-[length:var(--type-eyebrow)] ${
                          f.severity === "suspicious" ? "text-red-600" : "text-amber-700"
                        }`}
                      >
                        • {f.message}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Autofill rescue — paste the product copy or drop a screenshot. */}
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
                  {editTarget.url && (
                    <button
                      type="button"
                      onClick={rescrapeProduct}
                      disabled={rescraping}
                      title="Re-scrape the product page and overwrite the stored details"
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white folio-meta font-medium disabled:opacity-50 hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
                    >
                      {rescraping ? "Refreshing…" : "Refresh from the web"}
                    </button>
                  )}
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
                onClick={onClose}
                disabled={editSaving}
                className="flex-1 px-4 py-2 ridge-card text-sm font-medium text-folio-text-primary hover:bg-surface-ground transition-colors text-center disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEditProduct}
                disabled={editSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
