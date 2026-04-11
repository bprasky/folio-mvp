"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

interface RecommendedProduct {
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  category: string | null;
  score: number;
  matchReasons: { attribute: string; type: string; confidence: number }[];
}

/**
 * For You discovery feed — personalized product recommendations
 * based on the user's taste profile (inferred from saves, tags, likes).
 */
export function ForYouFeed() {
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch("/api/recommendations?limit=24");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProducts(data.products || []);
      } catch {
        console.error("Failed to fetch recommendations");
      } finally {
        setLoading(false);
      }
    }
    fetchRecommendations();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-headline font-light"
          style={{ fontSize: "clamp(28px, 4vw, 42px)", color: "var(--folio-text-primary, #1a1a1a)" }}
        >
          For You
        </h1>
        <p
          className="font-body mt-2 max-w-lg"
          style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--folio-text-secondary, #6b6b6b)" }}
        >
          Products matched to your design taste — powered by your saves, tags, and project history.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{ aspectRatio: "3/4", background: "var(--surface-ground, #faf8f5)" }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && (
        <div
          className="text-center py-20 font-body"
          style={{ color: "var(--folio-text-tertiary, #9b9b9b)" }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>&#9825;</div>
          <p style={{ fontSize: "15px" }}>
            Save and tag more products to unlock personalized recommendations.
          </p>
          <p style={{ fontSize: "13px", marginTop: "4px" }}>
            Your taste profile builds as you interact with products across Folio.
          </p>
        </div>
      )}

      {/* Product grid */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product, i) => (
            <motion.div
              key={product.productId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Link
                href={`/products/${product.productId}`}
                className="block group"
              >
                {/* Image */}
                <div
                  className="relative rounded-xl overflow-hidden mb-2.5"
                  style={{ aspectRatio: "3/4", background: "var(--surface-ground, #faf8f5)" }}
                >
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-body"
                      style={{ color: "var(--folio-text-tertiary)", fontSize: "32px" }}>
                      &#9671;
                    </div>
                  )}
                </div>

                {/* Name + brand */}
                <div
                  className="font-body font-medium truncate"
                  style={{ fontSize: "13px", color: "var(--folio-text-primary, #1a1a1a)" }}
                >
                  {product.name}
                </div>
                {product.brand && (
                  <div
                    className="font-body truncate"
                    style={{ fontSize: "11px", color: "var(--folio-text-tertiary, #9b9b9b)" }}
                  >
                    {product.brand}
                  </div>
                )}

                {/* Match reasons as chips */}
                {product.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {product.matchReasons.map((reason, j) => (
                      <span
                        key={j}
                        className="font-body"
                        style={{
                          fontSize: "9px",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          background: "rgba(201, 169, 110, 0.12)",
                          color: "#8a7044",
                        }}
                      >
                        {reason.attribute}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
