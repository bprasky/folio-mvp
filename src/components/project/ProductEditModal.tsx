"use client";

import styles from "@/components/ui/WorkflowForms.module.css";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editPasteText, setEditPasteText] = useState("");
  const [editParsing, setEditParsing] = useState<null | "text" | "image">(null);
  const [rescraping, setRescraping] = useState(false);

  // Pre-fill from the current record.
  useEffect(() => {
    let cancelled = false;
    setEditError(null);
    (async () => {
      try {
        const r = await fetch(`/api/products/${productId}`);
        if (!r.ok) throw new Error("Product details could not be loaded. Please try again.");
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
      } catch (error) {
        if (!cancelled) setEditError(error instanceof Error ? error.message : 'Product details could not be loaded. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, loadAttempt]);

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
    <Dialog open placement="right" onOpenChange={open => { if (!open && !editSaving) onClose(); }} backdropClassName="bg-black/40">
      <DialogContent placement="right" aria-describedby={undefined} className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <DialogTitle className={styles.sheetTitle}>Edit product details</DialogTitle>
          <button
            onClick={onClose}
            disabled={editSaving}
            aria-label="Close product details"
            className={styles.close}
            title="Close"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {!editTarget ? (
          <div className="px-5 py-10 text-center">
            {editError ? <><p role="alert" className="folio-body">{editError}</p><button className="mt-4 min-h-11 px-4 folio-ui underline" onClick={() => setLoadAttempt(value => value + 1)}>Try again</button></> : <>
            <div aria-hidden className="animate-spin h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
            <p role="status" className="folio-meta text-folio-text-secondary">Loading product…</p>
            </>}
          </div>
        ) : (
          <>
            <div className={`${styles.sheetBody} space-y-6`}>
              {editError && (
                <div role="alert" className={`${styles.notice} flex items-start gap-2`}>
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
                  <div className={styles.notice}>
                    <div className="flex items-center gap-1.5 text-[length:var(--type-eyebrow)] font-medium text-folio-text-secondary">
                      <FaExclamationCircle className="w-3 h-3" />
                      This product&apos;s details look incomplete or off:
                    </div>
                    {h.flags.map((f, i) => (
                      <div
                        key={i}
                        className={`pl-4.5 text-[length:var(--type-eyebrow)] ${
                          f.severity === "suspicious" ? "text-folio-text-primary" : "text-folio-text-secondary"
                        }`}
                      >
                        • {f.message}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Autofill rescue — paste the product copy or drop a screenshot. */}
              <details className={styles.disclosure}><summary>Autofill options</summary><div className="space-y-4">
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
                  aria-label="Product page text for autofill"
                  value={editPasteText}
                  onChange={(e) => setEditPasteText(e.target.value)}
                  placeholder="Paste the product name, specs, price… from the page"
                  rows={3}
                  className={styles.field}
                />
                <div className="flex flex-wrap gap-2">
                  {editTarget.url && (
                    <button
                      type="button"
                      onClick={rescrapeProduct}
                      disabled={rescraping}
                      title="Re-scrape the product page and overwrite the stored details"
                      className={styles.secondary}
                    >
                      {rescraping ? "Refreshing…" : "Refresh from the web"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleEditParseText}
                    disabled={editParsing !== null || !editPasteText.trim()}
                    className={styles.secondary}
                  >
                    {editParsing === "text" ? "Reading…" : "Autofill from text"}
                  </button>
                  <label className={`${styles.secondary} focus-within:ring-2 focus-within:ring-folio-gold`}>
                    <FaImage className="w-3.5 h-3.5" />
                    {editParsing === "image" ? "Reading screenshot…" : "Upload a screenshot"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        handleEditScreenshot(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div></details>

              {renderPreviewField("Name", editTarget.name, (v) => updateEdit({ name: v }))}
              <div className={styles.row}>
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
            <div className={styles.sheetFooter}>
              <button
                onClick={onClose}
                disabled={editSaving}
                className={styles.secondary}
              >
                Cancel
              </button>
              <button
                onClick={saveEditProduct}
                disabled={editSaving}
                className={styles.primary}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
