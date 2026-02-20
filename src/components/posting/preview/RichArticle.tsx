"use client";

import { Blocks, normalizePullQuote } from "@/lib/posting/schemas";
import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import InlineTagLink from '@/components/posting/interactive/InlineTagLink';
import InTheDetails from '@/components/posting/interactive/InTheDetails';

interface RichArticleProps {
  article: Blocks;
  heroImage?: { id: string; url: string } | null;
  tags?: Array<{ id: string; productName: string; productId?: string }>;
  author?: { name?: string };
  projectTitle?: string;
  images?: Array<{ id: string; url: string; caption?: string }>;
}

type ArticleBlocks = Blocks & {
  sections?: Array<{ 
    type: 'narrative'|'pullquote'|'qa'; 
    heading?: string; 
    body?: string; 
    quote?: string; 
    qa?: Array<{q:string;a:string}>; 
    productIds?: string[]; 
    imageId?: string 
  }>;
};

// Extract product IDs from materialsLedger
function extractProductIds(blocks: ArticleBlocks): string[] {
  const ids = new Set<string>();
  blocks.materialsLedger?.items?.forEach(i => {
    if (i.productId) ids.add(i.productId);
  });
  return Array.from(ids);
}


// Render paragraph with inline tag links
function renderParagraphWithTags({
  text,
  productIds,
  onAddToBoard,
}: {
  text: string;
  productIds?: string[];
  onAddToBoard?: (id: string) => void;
}) {
  if (!productIds?.length) {
    return <p className="leading-relaxed text-base md:text-lg text-[var(--text-secondary)]">{text}</p>;
  }

  // For now, append inline tag links at the end of the paragraph
  // In the future, this could be enhanced to tokenize and insert tags in-text
  return (
    <p className="leading-relaxed text-base md:text-lg text-[var(--text-secondary)]" data-product-ids={productIds.join(',')}>
      {text}{' '}
      {productIds.map((id) => (
        <InlineTagLink key={id} productId={id} label="↗ view" onAddToBoard={onAddToBoard} />
      ))}
    </p>
  );
}

export function RichArticle({
  article,
  heroImage,
  tags = [],
  author,
  projectTitle,
  images = [],
}: RichArticleProps) {
  const title = article.lead?.kicker || projectTitle || "Untitled Project";
  const dek = article.lead?.deck;
  
  // Determine mode (default to recomposition for new articles)
  const mode = (article as any).mode ?? 'recomposition';
  const showQA = false; // never show in recomposition
  const showMethod = false; // never show in recomposition

  // Extract product IDs from materialsLedger
  const productIds = useMemo(() => extractProductIds(article as ArticleBlocks), [article]);

  // Get all product data for "In the Details" section
  const [productsData, setProductsData] = useState<Array<{ id: string; name: string; imageUrl?: string }>>([]);
  
  useEffect(() => {
    if (productIds.length === 0) {
      setProductsData([]);
      return;
    }
    
    // Fetch product data for "In the Details"
    Promise.all(
      productIds.map(async (id) => {
        try {
          const res = await fetch(`/api/products/${id}`);
          if (!res.ok) return null;
          const d = await res.json();
          return {
            id: String(d.id || ''),
            name: String(d.name || ''),
            imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
          };
        } catch {
          return null;
        }
      })
    ).then(results => {
      const validResults: Array<{ id: string; name: string; imageUrl?: string }> = [];
      results.forEach(r => {
        if (r !== null && typeof r.id === 'string' && typeof r.name === 'string') {
          validResults.push({
            id: r.id,
            name: r.name,
            imageUrl: r.imageUrl,
          });
        }
      });
      setProductsData(validResults);
    });
  }, [productIds]);

  // Handle "Save to Board" action
  const handleAddToBoard = (productId: string) => {
    // TODO: Wire to actual Board/Collections API
    console.log('[RichArticle] Add to board:', productId);
  };

  const handleSaveAll = (ids: string[]) => {
    // TODO: Wire to actual Board/Collections API
    console.log('[RichArticle] Save all to board:', ids);
  };

  // Extract narrative paragraphs and pull quotes from galleryChapters[0].body
  const narrativeParagraphs = article.galleryChapters?.[0]?.body || [];
  // Normalize and deduplicate pull quotes (handles both string and {text, context} formats)
  const pullQuotes = (article.pullQuotes || [])
    .map((q: any) => normalizePullQuote(q))
    .filter((q) => q.text?.trim())
    .filter((q, i, arr) => arr.findIndex(other => other.text.trim() === q.text.trim()) === i);

  // Check if we have any content to show
  const hasContent = narrativeParagraphs.length > 0 || pullQuotes.length > 0;

  return (
    <article className="rounded-3xl shadow-xl backdrop-blur-sm bg-[var(--bg-base)] p-6 md:p-10 max-w-7xl mx-auto prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-semibold">
      {/* Title */}
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
          {title}
        </h1>
        {dek && (
          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-3xl leading-relaxed opacity-80">
            {dek}
          </p>
        )}
      </header>

      {/* Hero Image */}
      {heroImage && (
        <div className="mb-10 aspect-video md:rounded-2xl overflow-hidden bg-[var(--bg-elevated)]">
          <Image
            src={heroImage.url}
            alt={title}
            width={1200}
            height={675}
            className="w-full h-full object-cover"
            priority
          />
        </div>
      )}

      {/* Main Content: Single column narrative */}
      {!hasContent ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">Editorial content missing.</p>
          <p className="text-sm mt-2">Click <strong>Regenerate</strong> to generate an article.</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {/* Narrative paragraphs from galleryChapters[0].body */}
          {narrativeParagraphs.length > 0 && (
            <div className="space-y-6">
              {narrativeParagraphs.map((paragraph, idx) => {
                const paragraphProductIds = productIds.length > 0 ? productIds : undefined;
                
                return (
                  <div 
                    key={`narr-${idx}`} 
                    data-paragraph-idx={idx}
                    data-product-ids={paragraphProductIds?.join(',') || ''}
                  >
                    {renderParagraphWithTags({
                      text: paragraph,
                      productIds: paragraphProductIds,
                      onAddToBoard: handleAddToBoard,
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pull Quotes (simple styled, no animation) */}
          {pullQuotes.length > 0 && (
            <div className="space-y-6 my-8">
              {pullQuotes.map((quote, idx) => (
                <blockquote key={`quote-${idx}`} className="border-l-4 border-[var(--ridge-outer)] pl-6 text-lg text-[var(--text-secondary)]">
                  {quote.context && (
                    <span className="block text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-2 not-italic">
                      {quote.context}
                    </span>
                  )}
                  <span className="italic">&ldquo;{quote.text}&rdquo;</span>
                </blockquote>
              ))}
            </div>
          )}

          {/* Fallback: render from sections array if galleryChapters body is empty (legacy support) */}
          {narrativeParagraphs.length === 0 &&
            (((article as any).sections && Array.isArray((article as any).sections) && (article as any).sections.length > 0) ||
             (article.data && (article.data as any).sections && Array.isArray((article.data as any).sections) && (article.data as any).sections.length > 0)) && (
            <div className="space-y-6">
              {((article as any).sections || (article.data as any)?.sections || [])
                .filter((s: any) => s?.type === 'narrative' && s.body)
                .slice(0, 10)
                .map((s: any, idx: number) => {
                  const paragraphProductIds = (s.productIds && Array.isArray(s.productIds) && s.productIds.length > 0) 
                    ? s.productIds 
                    : (productIds.length > 0 ? productIds : undefined);
                  return (
                    <div 
                      key={`narr-fallback-${idx}`}
                      data-paragraph-idx={idx}
                      data-product-ids={paragraphProductIds?.join(',') || ''}
                    >
                      {renderParagraphWithTags({
                        text: s.body,
                        productIds: paragraphProductIds,
                        onAddToBoard: handleAddToBoard,
                      })}
                    </div>
                  );
                })}
            </div>
          )}

          {/* In the Details Section */}
          {productIds.length > 0 && (
            <InTheDetails
              productIds={productIds}
              products={productsData}
              onSaveAll={handleSaveAll}
            />
          )}
        </div>
      )}

      {/* Gallery Chapters (Images with optional additional narrative) */}
      {article.galleryChapters && article.galleryChapters.length > 0 && (
        <div className="space-y-12 mb-10 mt-12">
          {article.galleryChapters.map((chapter, idx) => {
            // Skip body rendering for first chapter if we already rendered it above (recomposition mode)
            const skipBody = idx === 0 && mode === 'recomposition' && chapter.body && chapter.body.length > 0;
            
            return (
              <section key={idx} className="space-y-6">
                {chapter.title && idx > 0 && (
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                    {chapter.title}
                  </h2>
                )}

                {/* Body paragraphs (only for subsequent chapters or if first chapter body wasn't rendered above) */}
                {!skipBody && chapter.body && chapter.body.length > 0 && (
                  <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                    {chapter.body.map((paragraph, pIdx) => (
                      <p key={pIdx} className="text-base md:text-lg">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}

                {/* Pull quote within chapter */}
                {chapter.pullQuote && (
                  <blockquote className="border-l-4 border-[var(--ridge-outer)] pl-6 italic text-lg text-[var(--text-secondary)] my-6">
                    "{chapter.pullQuote}"
                  </blockquote>
                )}

                {/* Images for this chapter */}
                {chapter.imageIds && chapter.imageIds.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {chapter.imageIds.slice(0, 8).map((imageId, imgIdx) => {
                      const image = images.find((img) => img.id === imageId);
                      if (!image) return null;

                      return (
                        <div
                          key={imageId}
                          className={`${
                            imgIdx === 0 && chapter.imageIds!.length > 2
                              ? "md:col-span-2"
                              : ""
                          } aspect-video bg-[var(--bg-elevated)] rounded-lg overflow-hidden relative`}
                        >
                          <Image
                            src={image.url}
                            alt={image.caption || chapter.title || "Project image"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                          {image.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                              {image.caption}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Materials Ledger */}
      {article.materialsLedger?.items && article.materialsLedger.items.length > 0 && (
        <section className="mb-10 mt-12">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-primary)] mb-4">
            Materials
          </h2>
          <ul className="space-y-2">
            {article.materialsLedger.items.map((item, idx) => (
              <li key={idx} className="text-base text-[var(--text-secondary)]">
                <span className="font-medium">{item.name}</span>
                {item.finish && <span className="text-[var(--text-tertiary)]"> • {item.finish}</span>}
                {item.note && <span className="text-[var(--text-tertiary)] text-sm"> • {item.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Credits */}
      {article.credits && article.credits.length > 0 && (
        <footer className="mt-12 pt-8 border-t border-[var(--ridge-outer)]">
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
            {article.credits.map((credit, idx) => (
              <div key={idx}>
                <span className="font-medium">{credit.role}:</span>{" "}
                {credit.url ? (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {credit.name}
                  </a>
                ) : (
                  <span>{credit.name}</span>
                )}
              </div>
            ))}
          </div>
          {author?.name && (
            <div className="mt-4 text-sm text-[var(--text-tertiary)]">
              By {author.name}
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
