"use client";

import Image from "next/image";
import { TagRail } from "./TagRail";
import { MaterialsLedger } from "./MaterialsLedger";
import { Credits } from "./Credits";
import CinematicHero from "@/components/article/CinematicHero";
import { DesignerSignature } from "@/components/article/DesignerSignature";
import { ProductGrid } from "@/components/article/ProductGrid";
import { MotionPullQuote } from "@/components/article/MotionPullQuote";
import { normalizePullQuote } from "@/lib/posting/schemas";
import { RelatedProjects } from "@/components/article/RelatedProjects";
import ScrollSyncPanel from "@/components/posting/interactive/ScrollSyncPanel";
import {
  resolveMaterialImage,
  resolveMaterialHref,
  resolveMaterialName,
  resolveVendorName,
} from "@/components/article/utils/materialResolvers";
import FeatureDiptych from "@/components/article/images/FeatureDiptych";
import ChapterGallery from "@/components/article/images/ChapterGallery";
import MaterialPair from "@/components/article/images/MaterialPair";
import {
  normImages,
  dedupeImages,
  ImageLike,
  normalizeUrl,
} from "@/components/article/images/utils";

interface PostExpandedProps {
  payload: any;
}

export function PostExpanded({ payload }: PostExpandedProps) {
  const {
    post,
    project,
    heroImage,
    images,
    tags,
    derivedMaterialsLedger,
    designer,
    relatedProjects,
  } = payload;
  const blocks = post.expandedBlocks || {};

  // Extract editorial content
  const leadTitle = blocks?.lead?.title || blocks?.lead?.kicker || project.title || "";
  const leadDeck = blocks?.lead?.deck || post.excerpt || null;
  // Normalize and deduplicate pull quotes
  const normalizedQuotes = Array.isArray(blocks?.pullQuotes)
    ? blocks.pullQuotes
        .map((q: any) => normalizePullQuote(q))
        .filter((q: { text: string }) => q.text?.trim())
        .filter((q: { text: string }, i: number, arr: { text: string }[]) =>
          arr.findIndex(other => other.text.trim() === q.text.trim()) === i
        )
    : [];
  const firstQuote = normalizedQuotes[0] ?? null;

  // Build product grid items from materials ledger
  const projectImages = images || [];
  const productItems =
    derivedMaterialsLedger?.map((m: any, i: number) => ({
      id: m?.productId || m?.id || `mat-${i}`,
      name: resolveMaterialName(m),
      imageUrl: resolveMaterialImage(m, projectImages),
      vendorName: resolveVendorName(m),
      href: resolveMaterialHref(m),
    })) || [];

  // Prepare images for scroll sync
  const galleryImages =
    blocks?.galleryChapters?.[0]?.imageIds?.map((id: string) => {
      const img = images.find((i: any) => i.id === id);
      return img?.url || null;
    }).filter(Boolean) || [];

  const imagesById: Record<string, string> = {};
  galleryImages.forEach((url: string, idx: number) => {
    if (url) imagesById[`img-${idx}`] = url;
  });
  const imageMap = galleryImages.map((_: any, idx: number) => `img-${idx}`);

  // Designer info
  const designerName = designer?.studio || designer?.name || null;
  const designerHref = designer?.id ? `/designer/${designer.id}` : null;

  // Page-level unique image consumer to prevent repetition across all sections
  function makeUniqConsumer() {
    const seen = new Set<string>();
    const key = (im: any) =>
      String(im.id || normalizeUrl(im.url) || im.url || "");
    return function consume(list: any[]) {
      const out: any[] = [];
      for (const im of list || []) {
        const k = key(im);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(im);
      }
      return out;
    };
  }

  const consume = makeUniqConsumer();

  // HERO - Build and consume unique images
  let heroImages = dedupeImages(
    normImages(blocks?.gallery?.images || blocks?.lead?.images || [])
  );
  heroImages = consume(heroImages);
  // Only show FeatureDiptych if we have multiple hero images, otherwise use CinematicHero
  const hasMultipleHeroImages = heroImages.length > 1;

  // CHAPTERS - Extract and consume unique images per group
  const rawChapterGroups: any[] = Array.isArray(blocks?.chapters)
    ? blocks.chapters
    : Array.isArray(blocks?.galleryChapters)
    ? blocks.galleryChapters
    : [];

  const chapterImagesList = rawChapterGroups
    .map((grp) =>
      consume(
        dedupeImages(
          normImages(
            grp?.images ||
              grp?.assets ||
              (Array.isArray(grp?.imageIds)
                ? grp.imageIds
                    .map((id: string) =>
                      images.find((img: any) => img.id === id)
                    )
                    .filter(Boolean)
                : [])
          )
        )
      )
    )
    .filter((arr) => arr.length > 0);

  // MATERIAL PAIRS - Ensure each image is unique vs prior sections
  const materialPairs = Array.isArray(blocks?.materials)
    ? blocks.materials
        .map((m: any) => {
          const context = consume(
            dedupeImages(
              normImages(
                [m?.contextImage || m?.roomImage || m?.selection?.image].filter(
                  Boolean
                ) || []
              )
            )
          )[0];
          const detail = consume(
            dedupeImages(
              normImages([m?.detailImage || m?.macroImage].filter(Boolean) || [])
            )
          )[0];
          return context || detail
            ? { context, detail, caption: m?.caption || null }
            : null;
        })
        .filter(Boolean)
    : [];

  return (
    <article className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 1) Cinematic hero */}
      {heroImage?.url && (
        <CinematicHero
          imageUrl={heroImage.url}
          title={leadTitle}
          deck={leadDeck}
        />
      )}

      {/* Title (if not in hero) */}
      {!heroImage?.url && (
        <header className="mb-8">
          {blocks.lead?.kicker && (
            <p className="text-sm uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              {blocks.lead.kicker}
            </p>
          )}
          <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">
            {leadTitle}
          </h1>
          {leadDeck && <p className="text-xl text-[var(--text-secondary)] mb-4">{leadDeck}</p>}
        </header>
      )}

      {/* 2) Designer signature block */}
      {designer && (
        <DesignerSignature
          signature={designer.bio ? designer.bio.split(".")[0] + "." : null}
          designerName={designerName}
          logoUrl={designer.profileImage || null}
          profileHref={designerHref}
        />
      )}

      {/* Tag Rail */}
      {tags && tags.length > 0 && (
        <div className="mb-8">
          <TagRail tags={tags} />
        </div>
      )}

      {/* Rhythm: feature → diptych/triptych (only if multiple images, otherwise CinematicHero handles single hero) */}
      {hasMultipleHeroImages && heroImages?.length > 0 && (
        <FeatureDiptych images={heroImages} />
      )}

      {/* 4) Narrative with motion pull quote + scroll-sync images */}
      {blocks.galleryChapters && Array.isArray(blocks.galleryChapters) && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10">
          <div>
            {blocks.galleryChapters.map((chapter: any, idx: number) => (
              <div key={idx} className="space-y-6">
                {chapter.title && (
                  <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                    {chapter.title}
                  </h2>
                )}
                {chapter.body && Array.isArray(chapter.body) && (
                  <div className="prose max-w-none">
                    {chapter.body.map((para: string, pIdx: number) => (
                      <p
                        key={pIdx}
                        data-paragraph-idx={pIdx}
                        className="text-[15px] leading-7 text-[var(--text-primary)] mb-4"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                )}
                {/* Motion pull quote */}
                {idx === 0 && firstQuote && (
                  <MotionPullQuote text={firstQuote.text} context={firstQuote.context} />
                )}
                {/* Chapter gallery if chapter has images */}
                {chapter.imageIds && Array.isArray(chapter.imageIds) && (
                  <ChapterGallery
                    images={dedupeImages(
                      normImages(
                        chapter.imageIds
                          .map((id: string) => images.find((img: any) => img.id === id))
                          .filter(Boolean)
                      )
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Scroll sync panel (desktop only) */}
          {galleryImages.length > 0 && (
            <div className="sticky top-24 hidden lg:block h-fit">
              <ScrollSyncPanel imageMap={imageMap} imagesById={imagesById} />
            </div>
          )}
        </div>
      )}

      {/* Fallback: narrative sections if no galleryChapters */}
      {(!blocks.galleryChapters || !Array.isArray(blocks.galleryChapters)) &&
        blocks.sections &&
        Array.isArray(blocks.sections) && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10">
            <div>
              {blocks.sections
                .filter((s: any) => s?.type === "narrative" && s?.body)
                .map((section: any, idx: number) => (
                  <div key={idx} className="mb-6">
                    {section.heading && (
                      <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">
                        {section.heading}
                      </h2>
                    )}
                    <p
                      data-paragraph-idx={idx}
                      className="text-[15px] leading-7 text-[var(--text-primary)]"
                    >
                      {section.body}
                    </p>
                  </div>
                ))}
              {firstQuote && <MotionPullQuote text={firstQuote.text} context={firstQuote.context} />}
            </div>
            {galleryImages.length > 0 && (
              <div className="sticky top-24 hidden lg:block h-fit">
                <ScrollSyncPanel imageMap={imageMap} imagesById={imagesById} />
              </div>
            )}
          </div>
        )}

      {/* Method */}
      {blocks.method && Array.isArray(blocks.method) && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Method</h2>
          <ul className="space-y-2 list-disc list-inside text-[var(--text-secondary)]">
            {blocks.method.map((item: string, idx: number) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Q&A */}
      {blocks.qa && Array.isArray(blocks.qa) && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">Q&A</h2>
          <div className="space-y-6">
            {blocks.qa.map((item: any, idx: number) => (
              <div key={idx}>
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                  {item.q}
                </h3>
                <p className="text-[var(--text-secondary)]">{item.a}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">— {item.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapter clusters (standalone galleries) */}
      {chapterImagesList?.map((imgs: ImageLike[], i: number) => {
        if (!imgs.length) return null;
        return <ChapterGallery key={i} images={imgs} />;
      })}

      {/* 3) Interactive product grid */}
      <ProductGrid items={productItems} />

      {/* In-situ + detail pairs (materials storytelling) */}
      {materialPairs?.length > 0 && (
        <section className="mt-8 space-y-6">
          {materialPairs.map((p: any, i: number) => (
            <MaterialPair
              key={i}
              context={p.context}
              detail={p.detail}
              caption={p.caption}
            />
          ))}
        </section>
      )}

      {/* Materials Ledger (keep for detailed view) */}
      {derivedMaterialsLedger && derivedMaterialsLedger.length > 0 && (
        <div className="mb-12">
          <MaterialsLedger ledger={derivedMaterialsLedger} />
        </div>
      )}

      {/* Credits */}
      {post.credits && (
        <div className="mb-8">
          <Credits credits={post.credits} />
        </div>
      )}

      {/* 5) Related projects footer */}
      {relatedProjects && relatedProjects.length > 0 && (
        <RelatedProjects items={relatedProjects} />
      )}
    </article>
  );
}
