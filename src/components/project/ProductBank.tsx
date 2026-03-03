"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { decodeHtmlEntities } from "@/lib/utils";

/**
 * ProductBank — Expandable product cards with per-contributor commentary.
 *
 * Shows all tagged products from the project. Each card expands to reveal
 * what each contributor (designer, architect, contractor, vendor) said about
 * that specific product during their interview.
 *
 * The AI editorial is the highlight reel — this is the director's commentary.
 * Nothing gets lost; it's tucked here instead of bloating the article.
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
  tagIds: string[]; // All ProductTag IDs for this product (may span multiple images)
};

export function ProductBank({ post, supplementalQuotes = [] }: ProductBankProps) {
  // Build unique product list from all image tags
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
        } else {
          productMap.set(product.id, {
            id: product.id,
            name: decodeHtmlEntities(product.name || ""),
            imageUrl: product.imageUrl || product.cutoutImageUrl,
            url: product.url,
            vendorName: product.vendor?.companyName || product.vendor?.name,
            category: product.category,
            finish: product.brand,
            tagIds: [tag.id],
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
  function getQuotesForProduct(product: ProductEntry): SupplementalQuote[] {
    const quotes: SupplementalQuote[] = [];
    for (const tagId of product.tagIds) {
      const tagQuotes = quotesByTagId.get(tagId);
      if (tagQuotes) quotes.push(...tagQuotes);
    }
    return quotes;
  }

  // Also pull materials ledger notes for products
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

  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-3 md:px-0">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="folio-ui tracking-[0.16em] uppercase text-[var(--text-secondary)]">
            Product Bank
          </h2>
          <span className="folio-meta text-[var(--text-tertiary)]">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>

        <div className="space-y-2">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quotes={getQuotesForProduct(product)}
              materialInfo={materialNotes.get(product.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  quotes,
  materialInfo,
}: {
  product: ProductEntry;
  quotes: SupplementalQuote[];
  materialInfo?: { finish?: string; note?: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = quotes.length > 0 || materialInfo?.note;

  return (
    <div className="ridge-card overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
          hasDetail ? "cursor-pointer hover:bg-[var(--bg-elevated)]" : "cursor-default"
        }`}
      >
        {/* Product thumbnail */}
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--ridge-outer)] flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
            <span className="folio-meta text-[var(--text-tertiary)]">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="folio-ui text-[var(--text-primary)] truncate">
            {product.name}
          </div>
          <div className="folio-meta text-[var(--text-secondary)] flex items-center gap-2">
            {product.vendorName && (
              <span className="uppercase tracking-[0.12em]">{product.vendorName}</span>
            )}
            {materialInfo?.finish && (
              <>
                <span className="text-[var(--text-tertiary)]">&middot;</span>
                <span>{materialInfo.finish}</span>
              </>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        {hasDetail && (
          <span className="folio-meta text-[var(--text-tertiary)] flex-shrink-0 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            &#9656;
          </span>
        )}

        {/* Quote count badge */}
        {quotes.length > 0 && !expanded && (
          <span className="folio-meta text-[var(--text-tertiary)] flex-shrink-0">
            {quotes.length} {quotes.length === 1 ? "voice" : "voices"}
          </span>
        )}
      </button>

      {/* Expanded: contributor commentary */}
      {expanded && (
        <div className="border-t border-[var(--ridge-outer)] px-4 py-4 space-y-4">
          {/* Material note from editorial */}
          {materialInfo?.note && (
            <p className="folio-meta text-[var(--text-secondary)] italic">
              {materialInfo.note}
            </p>
          )}

          {/* Per-contributor quotes */}
          {quotes.map((quote) => (
            <ContributorQuote key={quote.id} quote={quote} />
          ))}

          {/* Link to product page if available */}
          {product.url && (
            <div className="pt-2 border-t border-[var(--ridge-outer)]">
              <Link
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="folio-meta text-[var(--accent)] hover:underline"
              >
                View product details &rarr;
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContributorQuote({ quote }: { quote: SupplementalQuote }) {
  const [showFull, setShowFull] = useState(false);
  const isLong = quote.answer.length > 200;
  const displayText = isLong && !showFull
    ? quote.answer.slice(0, 200) + "..."
    : quote.answer;

  return (
    <div className="space-y-1">
      <div className="folio-meta font-medium text-[var(--text-primary)]">
        {quote.contributorRole || "Contributor"}
      </div>
      <blockquote className="folio-meta text-[var(--text-secondary)] leading-relaxed">
        &ldquo;{displayText}&rdquo;
      </blockquote>
      {isLong && (
        <button
          type="button"
          onClick={() => setShowFull(!showFull)}
          className="folio-meta text-[var(--accent)] hover:underline"
        >
          {showFull ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
