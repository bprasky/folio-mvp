"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { decodeHtmlEntities } from "@/lib/utils";

/**
 * ProductBank — Visual grid of contextual product crops grouped by room.
 *
 * Each card shows a contextual crop of the product from the designer's own
 * project photography. If no server-side crop exists yet, a CSS object-position
 * fallback approximates the crop using the tag's x,y coords.
 */

type SupplementalQuote = {
  id: string;
  question: string;
  answer: string;
  contributorRole: string | null;
  userId: string | null;
  productTagId: string | null;
  pinned: boolean;
  displayLocation: string | null;
  source: string;
};

type ProductBankProps = {
  post: any;
  supplementalQuotes?: SupplementalQuote[];
};

type ProductEntry = {
  id: string;
  name: string;
  imageUrl?: string;
  url?: string;
  vendorName?: string;
  category?: string;
  finish?: string;
  tagIds: string[];
  // Crop & source image data (from the best tag)
  cropUrl?: string;
  tagX?: number;
  tagY?: number;
  sourceImageUrl?: string;
  room?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  LIGHTING: "Lighting",
  FURNITURE: "Furniture",
  HARDWARE: "Hardware",
  PLUMBING_FIXTURE: "Plumbing",
  RUG: "Rugs",
  TEXTILE: "Textiles",
  ART: "Art",
  ACCESSORY: "Accessories",
  APPLIANCE: "Appliances",
  WINDOW_TREATMENT: "Window Treatments",
};

function getCategoryLabel(category?: string): string {
  if (!category) return "Other";
  return CATEGORY_LABELS[category.toUpperCase()] ?? category;
}

export function ProductBank({ post, supplementalQuotes = [] }: ProductBankProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Build unique product list from all image tags, with crop/source data
  const products = useMemo(() => {
    const productMap = new Map<string, ProductEntry>();

    post?.project?.images?.forEach((img: any) => {
      img.tags?.forEach((tag: any) => {
        const product = tag.product;
        if (!product) return;

        const existing = productMap.get(product.id);
        if (existing) {
          if (!existing.tagIds.includes(tag.id)) {
            existing.tagIds.push(tag.id);
          }
          // Prefer a tag that has a cropUrl
          if (!existing.cropUrl && tag.cropUrl) {
            existing.cropUrl = tag.cropUrl;
            existing.tagX = tag.x;
            existing.tagY = tag.y;
            existing.sourceImageUrl = img.url;
            existing.room = img.room;
          }
        } else {
          productMap.set(product.id, {
            id: product.id,
            name: decodeHtmlEntities(product.name || ""),
            imageUrl: product.imageUrl || product.cutoutImageUrl,
            url: product.url,
            vendorName: product.vendor?.companyName || product.vendor?.name || product.brand,
            category: product.category,
            finish: product.brand,
            tagIds: [tag.id],
            cropUrl: tag.cropUrl || undefined,
            tagX: tag.x,
            tagY: tag.y,
            sourceImageUrl: img.url,
            room: img.room,
          });
        }
      });
    });

    return Array.from(productMap.values());
  }, [post?.project?.images]);

  // Group supplemental quotes by productTagId
  const quotesByTagId = useMemo(() => {
    const map = new Map<string, SupplementalQuote[]>();
    for (const quote of supplementalQuotes) {
      if (!quote.productTagId) continue;
      const existing = map.get(quote.productTagId) || [];
      existing.push(quote);
      map.set(quote.productTagId, existing);
    }
    return map;
  }, [supplementalQuotes]);

  // Get quotes for a product (across all its tag IDs)
  const getQuotesForProduct = useCallback(
    (product: ProductEntry): SupplementalQuote[] => {
      const quotes: SupplementalQuote[] = [];
      for (const tagId of product.tagIds) {
        const tagQuotes = quotesByTagId.get(tagId);
        if (tagQuotes) quotes.push(...tagQuotes);
      }
      return quotes;
    },
    [quotesByTagId]
  );

  // Materials ledger notes
  const materialsLedger = post?.expandedBlocks?.materialsLedger;
  const materialNotes = useMemo(() => {
    const map = new Map<string, { finish?: string; note?: string }>();
    if (!materialsLedger?.items) return map;
    for (const item of materialsLedger.items) {
      if (item.productId) {
        map.set(item.productId, { finish: item.finish, note: item.note });
      }
    }
    return map;
  }, [materialsLedger]);

  // Available categories for filter pills
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (activeFilter === "all") return products;
    return products.filter((p) => p.category === activeFilter);
  }, [products, activeFilter]);

  // Group by room
  const roomGroups = useMemo(() => {
    const groups = new Map<string, ProductEntry[]>();
    for (const product of filteredProducts) {
      const room = product.room || "General";
      const existing = groups.get(room) || [];
      existing.push(product);
      groups.set(room, existing);
    }
    return groups;
  }, [filteredProducts]);

  const hasMultipleRooms = roomGroups.size > 1;

  if (products.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-3 md:px-0">
        <div className="px-6 py-5 md:px-8 md:py-6">
          <h2 className="font-['Instrument_Sans'] text-[11px] font-medium tracking-[0.16em] uppercase text-stone-400">
            Product Bank
          </h2>
          <p className="mt-6 text-center font-['Instrument_Sans'] text-[13px] text-stone-400">
            No products tagged yet
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-3 md:px-0">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-['Instrument_Sans'] text-[11px] font-medium tracking-[0.16em] uppercase text-stone-400">
            Product Bank
          </h2>
          <span className="font-['Instrument_Sans'] text-[12px] text-stone-400">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>

        {/* Category filter pills */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <FilterPill
              label="All"
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            />
            {categories.map((cat) => (
              <FilterPill
                key={cat}
                label={getCategoryLabel(cat)}
                active={activeFilter === cat}
                onClick={() => setActiveFilter(cat)}
              />
            ))}
          </div>
        )}

        {/* Product grid — grouped by room or flat */}
        {hasMultipleRooms ? (
          Array.from(roomGroups.entries()).map(([room, roomProducts]) => (
            <RoomSection
              key={room}
              room={room}
              products={roomProducts}
              expandedProductId={expandedProductId}
              onExpand={setExpandedProductId}
              getQuotes={getQuotesForProduct}
              materialNotes={materialNotes}
            />
          ))
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                expanded={expandedProductId === product.id}
                onExpand={() =>
                  setExpandedProductId(
                    expandedProductId === product.id ? null : product.id
                  )
                }
                quotes={getQuotesForProduct(product)}
                materialInfo={materialNotes.get(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Filter Pill ─── */

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1 rounded-full font-['Instrument_Sans'] text-[12px] transition-colors duration-150 ${
        active
          ? "bg-stone-800 text-white"
          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Room Section ─── */

function RoomSection({
  room,
  products,
  expandedProductId,
  onExpand,
  getQuotes,
  materialNotes,
}: {
  room: string;
  products: ProductEntry[];
  expandedProductId: string | null;
  onExpand: (id: string | null) => void;
  getQuotes: (product: ProductEntry) => SupplementalQuote[];
  materialNotes: Map<string, { finish?: string; note?: string }>;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between py-2 group"
      >
        <span className="font-['Instrument_Sans'] text-[11px] font-medium tracking-[0.16em] uppercase text-stone-400 group-hover:text-stone-600 transition-colors duration-150">
          {room}
        </span>
        <span className="font-['Instrument_Sans'] text-[11px] text-stone-400 flex items-center gap-2">
          {products.length} {products.length === 1 ? "product" : "products"}
          <span
            className="text-[10px] transition-transform duration-150"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  expanded={expandedProductId === product.id}
                  onExpand={() =>
                    onExpand(
                      expandedProductId === product.id ? null : product.id
                    )
                  }
                  quotes={getQuotes(product)}
                  materialInfo={materialNotes.get(product.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Product Card ─── */

function ProductCard({
  product,
  expanded,
  onExpand,
  quotes,
  materialInfo,
}: {
  product: ProductEntry;
  expanded: boolean;
  onExpand: () => void;
  quotes: SupplementalQuote[];
  materialInfo?: { finish?: string; note?: string };
}) {
  return (
    <div className="col-span-1">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left group"
      >
        {/* Image container — 1:1 aspect */}
        <div className="relative aspect-square rounded-xl overflow-hidden bg-stone-100 shadow-sm group-hover:shadow-md transition-all duration-150">
          {/* 2-letter fallback always rendered behind images */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-['Instrument_Sans'] text-[18px] font-medium text-stone-300">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="absolute inset-0 group-hover:scale-[1.02] transition-transform duration-150">
            {product.cropUrl ? (
              /* Server-generated crop */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.cropUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : product.sourceImageUrl ? (
              /* CSS fallback — zoom into source image at tag location */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.sourceImageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${(product.tagX ?? 0.5) * 100}% ${(product.tagY ?? 0.5) * 100}%`,
                  transform: "scale(2.2)",
                  transformOrigin: `${(product.tagX ?? 0.5) * 100}% ${(product.tagY ?? 0.5) * 100}%`,
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : product.imageUrl ? (
              /* Product catalog image fallback */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
          </div>
        </div>

        {/* Product info */}
        <div className="mt-2 px-0.5">
          <p className="font-['Instrument_Sans'] text-[13px] font-medium text-stone-800 line-clamp-2 leading-tight">
            {product.name}
          </p>
          {product.vendorName && (
            <p className="font-['Instrument_Sans'] text-[12px] text-stone-400 mt-0.5 truncate">
              {product.vendorName}
            </p>
          )}
        </div>
      </button>

      {/* Expanded detail — inline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ProductDetail
              product={product}
              quotes={quotes}
              materialInfo={materialInfo}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Product Detail (Expanded) ─── */

function ProductDetail({
  product,
  quotes,
  materialInfo,
}: {
  product: ProductEntry;
  quotes: SupplementalQuote[];
  materialInfo?: { finish?: string; note?: string };
}) {
  return (
    <div className="mt-2 rounded-xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg p-4 space-y-3">
      {/* Larger crop or source image — zoomed to product location */}
      {(product.cropUrl || product.sourceImageUrl) && (
        <div className="relative aspect-[4/3] rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.cropUrl || product.sourceImageUrl!}
            alt={product.name}
            className="w-full h-full object-cover"
            style={!product.cropUrl && product.tagX != null ? {
              objectPosition: `${product.tagX * 100}% ${(product.tagY ?? 0.5) * 100}%`,
              transform: "scale(2.0)",
              transformOrigin: `${product.tagX * 100}% ${(product.tagY ?? 0.5) * 100}%`,
            } : undefined}
          />
        </div>
      )}

      {/* Full product name */}
      <div>
        <h3 className="font-['Instrument_Sans'] text-[15px] font-medium text-stone-800">
          {product.name}
        </h3>
        {product.vendorName && (
          <p className="font-['Instrument_Sans'] text-[13px] text-stone-400 mt-0.5">
            {product.vendorName}
          </p>
        )}
      </div>

      {/* Category badge */}
      {product.category && (
        <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 font-['Instrument_Sans'] text-[11px] text-stone-500">
          {getCategoryLabel(product.category)}
        </span>
      )}

      {/* Material note from editorial */}
      {materialInfo?.note && (
        <p className="font-['Instrument_Sans'] text-[12px] text-stone-500 italic leading-relaxed">
          {materialInfo.note}
        </p>
      )}

      {/* Contributor quotes */}
      {quotes.length > 0 && (
        <div className="space-y-3 pt-1">
          {quotes.map((quote) => (
            <ContributorQuote key={quote.id} quote={quote} />
          ))}
        </div>
      )}

      {/* Source room context thumbnail */}
      {product.sourceImageUrl && (
        <div className="pt-1">
          <p className="font-['Instrument_Sans'] text-[10px] text-stone-400 uppercase tracking-wider mb-1">
            In context
          </p>
          <div className="relative w-20 h-14 rounded-md overflow-hidden ring-1 ring-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.sourceImageUrl}
              alt={`Room context for ${product.name}`}
              className="w-full h-full object-cover"
            />
            {/* Tag dot */}
            {product.tagX != null && product.tagY != null && (
              <div
                className="absolute w-2 h-2 rounded-full bg-white shadow-md border border-stone-300"
                style={{
                  left: `${product.tagX * 100}%`,
                  top: `${product.tagY * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Link to vendor product page */}
      {product.url && (
        <div className="pt-1 border-t border-stone-100">
          <Link
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-['Instrument_Sans'] text-[12px] text-stone-500 hover:text-stone-700 transition-colors duration-150"
          >
            View product details →
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Contributor Quote ─── */

function ContributorQuote({ quote }: { quote: SupplementalQuote }) {
  const [showFull, setShowFull] = useState(false);
  const isLong = quote.answer.length > 200;
  const displayText =
    isLong && !showFull ? quote.answer.slice(0, 200) + "..." : quote.answer;

  return (
    <div className="space-y-1">
      <div className="font-['Instrument_Sans'] text-[11px] font-medium text-stone-600 uppercase tracking-wider">
        {quote.contributorRole || "Contributor"}
      </div>
      <blockquote className="font-['Instrument_Sans'] text-[12px] text-stone-500 leading-relaxed">
        &ldquo;{displayText}&rdquo;
      </blockquote>
      {isLong && (
        <button
          type="button"
          onClick={() => setShowFull(!showFull)}
          className="font-['Instrument_Sans'] text-[11px] text-stone-400 hover:text-stone-600 transition-colors duration-150"
        >
          {showFull ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
