"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

interface FeedItem {
  type: "boosted_project" | "collaboration_article" | "vendor_article" | "product_launch";
  id: string;
  date: string;
  // Project fields
  productName?: string;
  productImage?: string;
  projectImage?: string;
  room?: string;
  projectTitle?: string;
  designerName?: string;
  designerImage?: string;
  articleSlug?: string;
  impressions?: number;
  hasQA?: boolean;
  // Article fields
  title?: string;
  excerpt?: string;
  heroImage?: string;
  contentType?: string;
  authorName?: string;
  authorImage?: string;
  slug?: string;
  views?: number;
  // Product fields
  brand?: string;
  category?: string;
}

const FILTER_PILLS = [
  { key: "all", label: "All" },
  { key: "projects", label: "Projects" },
  { key: "articles", label: "Articles" },
  { key: "products", label: "Products" },
];

interface VendorFeedProps {
  orgId: string;
}

export function VendorFeed({ orgId }: VendorFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/orgs/${orgId}/feed?type=${filter}&limit=12`)
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, filter]);

  return (
    <div>
      {/* Filter pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {FILTER_PILLS.map(pill => (
          <button
            key={pill.key}
            onClick={() => setFilter(pill.key)}
            className="font-body px-3.5 py-1.5 rounded-full cursor-pointer transition-colors flex-shrink-0"
            style={{
              fontSize: "12px",
              fontWeight: 500,
              background: filter === pill.key ? "#3a2a1a" : "rgba(245, 239, 232, 0.6)",
              color: filter === pill.key ? "#f5efe8" : "var(--folio-text-secondary, #6b6b6b)",
              border: "none",
            }}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse h-64" style={{ background: "var(--surface-ground, #faf8f5)" }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 font-body" style={{ color: "var(--folio-text-tertiary)", fontSize: "14px" }}>
          No content yet. Boost designer projects or create articles to populate the feed.
        </div>
      )}

      {/* Feed grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={`${item.type}-${item.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              {item.type === "boosted_project" && <MosaicCard item={item} />}
              {(item.type === "collaboration_article" || item.type === "vendor_article") && <ArticleCard item={item} />}
              {item.type === "product_launch" && <ProductLaunchCard item={item} />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Boosted project mosaic: product image + project photo side by side */
function MosaicCard({ item }: { item: FeedItem }) {
  const href = item.articleSlug ? `/p/${item.articleSlug}` : undefined;
  const Wrapper = href ? Link : "div";

  return (
    <Wrapper {...(href ? { href } : {})} className="block rounded-xl overflow-hidden group" style={{ background: "var(--surface-ground, #faf8f5)" }}>
      {/* Mosaic: product + project side by side */}
      <div className="flex" style={{ height: 200 }}>
        {/* Product image */}
        <div className="relative w-2/5 overflow-hidden">
          {item.productImage && (
            <Image src={item.productImage} alt={item.productName || ""} fill className="object-cover" sizes="200px" />
          )}
        </div>
        {/* Project image */}
        <div className="relative w-3/5 overflow-hidden">
          {item.projectImage && (
            <Image src={item.projectImage} alt={item.projectTitle || ""} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="300px" />
          )}
          {/* Room badge */}
          {item.room && (
            <div className="absolute top-2.5 left-2.5 font-body" style={{ fontSize: "9px", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", padding: "2px 7px", borderRadius: "4px", background: "rgba(255,255,255,0.9)", color: "#5a4a3a" }}>
              {item.room}
            </div>
          )}
          {item.hasQA && (
            <div className="absolute top-2.5 right-2.5 font-body" style={{ fontSize: "9px", fontWeight: 500, padding: "2px 7px", borderRadius: "4px", background: "rgba(201,169,110,0.9)", color: "white" }}>
              Q&A
            </div>
          )}
        </div>
      </div>
      {/* Info bar */}
      <div className="px-4 py-3">
        <div className="font-body font-medium truncate" style={{ fontSize: "13px", color: "var(--folio-text-primary)" }}>
          {item.productName}
        </div>
        <div className="font-body truncate" style={{ fontSize: "11px", color: "var(--folio-text-tertiary)" }}>
          {item.projectTitle} · {item.designerName}
        </div>
      </div>
    </Wrapper>
  );
}

/** Article card for collaboration or vendor-authored content */
function ArticleCard({ item }: { item: FeedItem }) {
  const href = item.articleSlug ? `/p/${item.articleSlug}` : item.slug ? `/vendor/posts/${item.slug}` : undefined;
  const isVendor = item.type === "vendor_article";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface-ground, #faf8f5)" }}>
      {item.heroImage && (
        <div className="relative" style={{ height: 180 }}>
          <Image src={item.heroImage} alt={item.title || ""} fill className="object-cover" sizes="400px" />
          <div className="absolute top-2.5 left-2.5 font-body" style={{ fontSize: "9px", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", padding: "2px 7px", borderRadius: "4px", background: isVendor ? "rgba(201,169,110,0.9)" : "rgba(255,255,255,0.9)", color: isVendor ? "white" : "#5a4a3a" }}>
            {isVendor ? (item.contentType === "product_launch" ? "Launch" : "Article") : "Collaboration"}
          </div>
        </div>
      )}
      <div className="px-4 py-3">
        <div className="font-body font-medium" style={{ fontSize: "14px", color: "var(--folio-text-primary)", lineHeight: 1.3 }}>
          {href ? <Link href={href} className="hover:underline">{item.title || item.projectTitle}</Link> : (item.title || item.projectTitle)}
        </div>
        {item.excerpt && (
          <p className="font-body mt-1 line-clamp-2" style={{ fontSize: "12px", color: "var(--folio-text-secondary)", lineHeight: 1.5 }}>
            {item.excerpt}
          </p>
        )}
        <div className="font-body mt-2" style={{ fontSize: "11px", color: "var(--folio-text-tertiary)" }}>
          {item.designerName || item.authorName}
          {item.views ? ` · ${item.views} views` : ""}
        </div>
      </div>
    </div>
  );
}

/** Product launch card */
function ProductLaunchCard({ item }: { item: FeedItem }) {
  return (
    <Link href={`/products/${item.id}`} className="block rounded-xl overflow-hidden group" style={{ background: "var(--surface-ground, #faf8f5)" }}>
      <div className="relative" style={{ height: 200 }}>
        {item.productImage && (
          <Image src={item.productImage} alt={item.productName || ""} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="400px" />
        )}
        <div className="absolute top-2.5 left-2.5 font-body" style={{ fontSize: "9px", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", padding: "2px 7px", borderRadius: "4px", background: "#639922", color: "white" }}>
          New
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="font-body font-medium" style={{ fontSize: "13px", color: "var(--folio-text-primary)" }}>{item.productName}</div>
        <div className="font-body" style={{ fontSize: "11px", color: "var(--folio-text-tertiary)" }}>{item.category || item.brand}</div>
      </div>
    </Link>
  );
}
