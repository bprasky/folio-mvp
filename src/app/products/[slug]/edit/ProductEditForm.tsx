'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  url: string | null;
  price: number | null;
  category: string | null;
  vendorId: string | null;
  vendor: { name: string; companyName: string | null } | null;
}

export function ProductEditForm({ product }: { product: ProductData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(product.name);
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '');
  const [brand, setBrand] = useState(
    product.brand || product.vendor?.companyName || product.vendor?.name || ''
  );
  const [url, setUrl] = useState(product.url || '');
  const [description, setDescription] = useState(product.description || '');

  const isMissing = (val: string) => !val.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          imageUrl: imageUrl.trim() || undefined,
          vendorName: brand.trim() || undefined,
          url: url.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push(`/products/${product.id}`), 1500);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product name */}
      <Field label="Product name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
          required
        />
      </Field>

      {/* Image URL */}
      <Field label="Product image URL" missing={isMissing(imageUrl)}>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="field-input"
        />
        {isMissing(imageUrl) && (
          <p className="text-[var(--type-eyebrow)] text-amber-600 mt-1">
            Adding an image makes this product visible in hover interactions and feeds.
          </p>
        )}
      </Field>

      {/* Brand / Vendor */}
      <Field label="Brand / Vendor" missing={isMissing(brand)}>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Holly Hunt, Restoration Hardware"
          className="field-input"
        />
        {isMissing(brand) && (
          <p className="text-[var(--type-eyebrow)] text-amber-600 mt-1">
            Vendor info helps designers source this product and connects it to the vendor's catalog.
          </p>
        )}
      </Field>

      {/* Product URL */}
      <Field label="Product URL" missing={isMissing(url)}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://vendor.com/product/..."
          className="field-input"
        />
        {isMissing(url) && (
          <p className="text-[var(--type-eyebrow)] text-amber-600 mt-1">
            A link lets designers go directly to the product page for specs and pricing.
          </p>
        )}
      </Field>

      {/* Description */}
      <Field label="Description" optional>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief description of the product..."
          className="field-input resize-none"
        />
      </Field>

      {/* Submit */}
      <div className="pt-2">
        {saved ? (
          <div className="text-center py-3 text-sm text-green-700 font-medium">
            Saved! Redirecting...
          </div>
        ) : (
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded-full bg-[var(--text-primary)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Product Details'}
          </button>
        )}
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: var(--border-emphasis, #9ca3af);
          box-shadow: 0 0 0 2px rgba(201, 169, 110, 0.1);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  missing,
  required,
  optional,
  children,
}: {
  label: string;
  missing?: boolean;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        missing ? 'bg-amber-50/60 border border-amber-200/50' : 'bg-white border border-folio-border-subtle'
      }`}
    >
      <label className="block text-[var(--type-eyebrow)] font-medium text-folio-text-secondary uppercase tracking-wide mb-1.5">
        {label}
        {missing && <span className="text-amber-600 ml-1">missing</span>}
        {optional && <span className="text-folio-text-tertiary ml-1">optional</span>}
      </label>
      {children}
    </div>
  );
}
