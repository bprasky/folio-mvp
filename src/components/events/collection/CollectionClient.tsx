"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type EventInfo = {
  id: string;
  title: string;
};

type ProductScan = {
  id: string;
  productId: string;
  scannedAt: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    vendorName: string | null;
    price: number | null;
  };
};

type VendorGroup = {
  vendorName: string;
  products: ProductScan[];
};

export default function CollectionClient({ event }: { event: EventInfo }) {
  const [scans, setScans] = useState<ProductScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScans() {
      try {
        const res = await fetch(`/api/events/${event.id}/my-scans`);
        if (res.ok) {
          const data = await res.json();
          setScans(data.scans ?? []);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    fetchScans();
  }, [event.id]);

  // Group by vendor
  const vendorGroups: VendorGroup[] = [];
  const vendorMap = new Map<string, ProductScan[]>();

  for (const scan of scans) {
    const vendor = scan.product.vendorName || "Unknown Vendor";
    if (!vendorMap.has(vendor)) vendorMap.set(vendor, []);
    vendorMap.get(vendor)!.push(scan);
  }

  for (const [vendorName, products] of vendorMap) {
    vendorGroups.push({ vendorName, products });
  }
  vendorGroups.sort((a, b) => b.products.length - a.products.length);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base,#fdfbf8)] flex items-center justify-center">
        <p className="text-sm text-stone-400">Loading your collection...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base,#fdfbf8)]">
      {/* Header */}
      <div className="glass-sticky px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-[var(--text-primary,#1c1917)]">
            My Collection &mdash; {event.title}
          </h1>
          <p className="text-sm text-[var(--text-secondary,#78716c)] mt-1">
            {scans.length} product{scans.length !== 1 ? "s" : ""} scanned
            &bull; {vendorGroups.length} vendor
            {vendorGroups.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {vendorGroups.map((group) => (
          <div key={group.vendorName}>
            <h2 className="text-sm font-semibold text-[var(--text-primary,#1c1917)] uppercase tracking-wider mb-3">
              {group.vendorName}{" "}
              <span className="text-stone-400 font-normal">
                ({group.products.length})
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {group.products.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/products/${scan.product.id}`}
                  className="group bg-white rounded-xl border border-[var(--border-light,#e7e5e4)] overflow-hidden hover:shadow-md transition-shadow"
                >
                  {scan.product.imageUrl ? (
                    <div className="aspect-square bg-stone-100">
                      <img
                        src={scan.product.imageUrl}
                        alt={scan.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-stone-100 flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-stone-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-[var(--text-primary,#1c1917)] truncate group-hover:text-[var(--accent,#c8a97e)] transition-colors">
                      {scan.product.name}
                    </p>
                    {scan.product.price != null && (
                      <p className="text-xs text-[var(--text-secondary,#78716c)] mt-0.5">
                        ${scan.product.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Footer actions */}
        <div className="flex gap-3 pt-4 border-t border-[var(--border-light,#e7e5e4)]">
          <a
            href={`/api/events/${event.id}/my-collection/export`}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-light,#e7e5e4)] text-[var(--text-primary,#1c1917)] hover:bg-stone-50 transition-colors"
          >
            Export as PDF
          </a>
        </div>
      </div>
    </div>
  );
}
