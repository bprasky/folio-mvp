"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from '@/components/FolioImage';
import Link from "next/link";

interface ShopProduct {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  materials: string[];
  style: string | null;
  price: number | null;
  dimensions: { w: number; d: number; h: number } | null;
  score?: number;
  matchReasons?: { attribute: string; type: string }[];
}

interface VendorShopProps {
  orgId: string;
}

export function VendorShop({ orgId }: VendorShopProps) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("curated");
  const [collections, setCollections] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/orgs/${orgId}/products?sort=${activeFilter}&limit=24`)
      .then(r => r.json())
      .then(data => {
        setProducts(data.products || []);
        setCollections(data.collections || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, activeFilter]);

  // Build filter pills dynamically
  const pills = [
    { key: "curated", label: "Curated for You" },
    { key: "featured", label: "Featured" },
    ...collections.map(c => ({ key: `collection:${c}`, label: c })),
  ];

  return (
    <div>
      {/* Filter pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {pills.map(pill => (
          <button
            key={pill.key}
            onClick={() => setActiveFilter(pill.key)}
            className="font-body px-3.5 py-1.5 rounded-full cursor-pointer transition-colors flex-shrink-0"
            style={{
              fontSize: 'var(--type-meta)',
              fontWeight: 'var(--w-h1)',
              background: activeFilter === pill.key ? "#3a2a1a" : "rgba(245, 239, 232, 0.6)",
              color: activeFilter === pill.key ? "#f5efe8" : "var(--folio-text-secondary)",
              border: "none",
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ aspectRatio: "3/4", background: "var(--surface-ground)" }} />
          ))}
        </div>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <Link href={`/products/${product.id}`} className="block group">
                <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: "3/4", background: "var(--surface-ground)" }}>
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-body" style={{ color: "var(--folio-text-tertiary)", fontSize: 'var(--type-h3)' }}>&#9671;</div>
                  )}
                </div>
                <div className="font-body font-medium truncate" style={{ fontSize: 'var(--type-meta)', color: "var(--folio-text-primary)" }}>{product.name}</div>
                {product.style && (
                  <div className="font-body truncate" style={{ fontSize: 'var(--type-eyebrow)', color: "var(--folio-text-tertiary)" }}>{product.style}</div>
                )}
                {product.materials.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.materials.slice(0, 2).map((m, j) => (
                      <span key={j} className="font-body" style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: "rgba(201,169,110,0.12)", color: "#8a7044" }}>{m}</span> /* folio-design-system: off-scale */
                    ))}
                  </div>
                )}
                {product.matchReasons && product.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.matchReasons.map((r, j) => (
                      <span key={j} className="font-body" style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "8px", background: "rgba(99,153,34,0.1)", color: "#4a7c59" }}>{r.attribute}</span> /* folio-design-system: off-scale */
                    ))}
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="text-center py-16 font-body" style={{ color: "var(--folio-text-tertiary)", fontSize: 'var(--type-ui)' }}>
          No products in this collection yet.
        </div>
      )}
    </div>
  );
}
