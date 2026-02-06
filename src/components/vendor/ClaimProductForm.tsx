"use client";

import { useState } from "react";

interface ClaimProductFormProps {
  previewTokenId: string;
  productId: string;
  vendorId: string | null;
  productName: string;
}

export default function ClaimProductForm({
  previewTokenId,
  productId,
  vendorId,
  productName,
}: ClaimProductFormProps) {
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/vendor/claim-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewTokenId,
          vendorName,
          vendorEmail,
          website,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to claim product");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-2">
          Product Claimed Successfully!
        </h3>
        <p className="text-green-700">
          Your product "{productName}" has been claimed. You can now complete its specifications and manage it from your vendor dashboard.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700 mb-1">
          Vendor Name *
        </label>
        <input
          type="text"
          id="vendorName"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          placeholder="Your company name"
        />
      </div>

      <div>
        <label htmlFor="vendorEmail" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address *
        </label>
        <input
          type="email"
          id="vendorEmail"
          value={vendorEmail}
          onChange={(e) => setVendorEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          placeholder="contact@yourcompany.com"
        />
      </div>

      <div>
        <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
          Website (optional)
        </label>
        <input
          type="url"
          id="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          placeholder="https://yourcompany.com"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Claiming..." : "Claim This Product"}
      </button>
    </form>
  );
}




