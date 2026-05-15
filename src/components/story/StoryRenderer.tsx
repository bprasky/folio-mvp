"use client";

// StoryRenderer — Top-level orchestrator for the Folio Story Format.
// Composes: StoryHero → StoryIntro → Mosaic → StoryCredits.
// Manages ProductSheet state and deep link routing.

import { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { buildStoryData, type StoryData } from "@/lib/story/buildRoomTiles";
import { StoryHero } from "./StoryHero";
import { StoryIntro } from "./StoryIntro";
import { Mosaic } from "./Mosaic";
import { ProductSheet } from "./ProductSheet";
import { StoryCredits } from "./StoryCredits";

interface StoryRendererProps {
  post: any;
}

export function StoryRenderer({ post }: StoryRendererProps) {
  const searchParams = useSearchParams();
  const [activeProduct, setActiveProduct] = useState<any | null>(null);

  // Detect reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Build story data from post
  const story = useMemo(() => buildStoryData(post), [post]);

  // Detect hero image orientation (portrait vs landscape).
  // Strict rule: only true portrait photos (taller than wide) get the split
  // layout. Everything wider — including squarish landscape — stays in the
  // immersive full-bleed stacked hero.
  const [heroOrientation, setHeroOrientation] = useState<"landscape" | "portrait" | null>(null);
  useEffect(() => {
    if (!story?.heroImageUrl) return;
    const img = new window.Image();
    img.onload = () => {
      setHeroOrientation(img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait");
    };
    img.src = story.heroImageUrl;
  }, [story?.heroImageUrl]);

  // Track external share discovery (Flywheel 6: UTM tracking)
  useEffect(() => {
    const utmSource = searchParams?.get("utm_source");
    if (utmSource === "folio_share" && post?.projectId) {
      fetch("/api/analytics/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "article_share_landing",
          payload: {
            projectId: post.projectId,
            postSlug: post.slug,
            utmSource,
            utmMedium: searchParams?.get("utm_medium"),
            utmCampaign: searchParams?.get("utm_campaign"),
          },
        }),
      }).catch(() => {});
    }
  }, [searchParams, post?.projectId, post?.slug]);

  // Deep link params
  const autoExpandRoom = searchParams?.get("room") ?? null;
  const autoProductId = searchParams?.get("product") ?? null;
  const refSource = searchParams?.get("ref") ?? null;

  // Log inbound referral signal
  useEffect(() => {
    if (refSource && post?.project?.id) {
      console.log("[STORY] Inbound referral:", {
        ref: refSource,
        projectId: post.project.id,
        slug: post.slug,
      });
      // Signal capture: INBOUND_REFERRAL
      // logPassiveEvent could be called here if analytics supports this type
    }
  }, [refSource, post?.project?.id, post?.slug]);

  // Auto-open product from deep link
  useEffect(() => {
    if (autoProductId && story) {
      for (const room of story.roomTiles) {
        const product = room.products.find((p: any) => p.id === autoProductId);
        if (product) {
          setActiveProduct(product);
          break;
        }
      }
    }
  }, [autoProductId, story]);

  const handleProductClick = useCallback((product: any) => {
    setActiveProduct(product);
    console.log("[STORY] PRODUCT_TAP:", { productId: product.id, name: product.name });
  }, []);

  const handleProductClose = useCallback(() => {
    setActiveProduct(null);
  }, []);

  if (!story) {
    // Fallback: if story data can't be built, return null
    // The parent page can show a fallback
    return null;
  }

  return (
    <div
      className="min-h-screen bg-surface-ground"
    >
      <div className="w-full pb-6 md:pb-10">
        {/* Hero + Intro: orientation-aware layout */}
        {heroOrientation === null ? (
          /* Skeleton while detecting orientation */
          <div
            className="w-full aspect-video rounded-[14px] animate-pulse"
            style={{ background: "rgba(87, 75, 67, 0.06)" }}
          />
        ) : heroOrientation === "portrait" ? (
          /* Portrait: intro left, photo right (stacks on mobile, text first) */
          <>
            <div className="flex flex-col md:flex-row gap-6 md:gap-10">
              <div className="w-full md:w-[52%] flex items-center">
                <StoryIntro story={story} compact />
              </div>
              <div className="w-full md:w-[48%]">
                <StoryHero imageUrl={story.heroImageUrl} alt={story.title} orientation="portrait" />
              </div>
            </div>
            <div className="border-b mt-6" style={{ borderColor: "rgba(87, 75, 67, 0.06)" }} />
          </>
        ) : (
          /* Landscape: editorial hero per E4 spec — eyebrow + title row,
             16:9 photo flush below, caption + counter row underneath. */
          <LandscapeHero story={story} publishedAt={post?.publishedAt ?? null} />
        )}

        {/* Mosaic: Room grid with expand-to-detail.
            Mobile (<md): tighter top gap (~40% less) to keep the first
            scroll productive after the editorial hero. */}
        <div className="mt-6 md:mt-10">
          <Mosaic
            roomTiles={story.roomTiles}
            breathers={story.breathers}
            supplementalQuotes={story.supplementalQuotes}
            onProductClick={handleProductClick}
            autoExpandRoom={autoExpandRoom}
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Credits */}
        <StoryCredits credits={story.credits} />
      </div>

      {/* Product Sheet: side panel (desktop) / bottom sheet (mobile) */}
      <ProductSheet
        product={activeProduct}
        onClose={handleProductClose}
        designerName={story.designerName}
        supplementalQuotes={story.supplementalQuotes}
      />
    </div>
  );
}

// --- Landscape hero (E4 spec) ---
// Centered 1168px container, 56px gutter. Eyebrow row, then 8fr/4fr title +
// byline grid, then a flush-bottom 16:9 cover photo, then a caption + counter
// row. Strict pixel values per spec — off the design-system type scale.

const HERO_DOT = (
  <span
    aria-hidden
    style={{
      display: "inline-block",
      width: 3, /* folio-design-system: off-scale */
      height: 3, /* folio-design-system: off-scale */
      borderRadius: "50%",
      background: "rgba(87, 75, 67, 0.45)",
      margin: "0 8px",
      verticalAlign: "middle",
    }}
  />
);

function LandscapeHero({ story, publishedAt }: { story: StoryData; publishedAt: string | Date | null }) {
  const dateLabel = publishedAt
    ? new Date(publishedAt).toLocaleString("en-US", { month: "long", year: "numeric" })
    : null;
  const heroRoom = story.heroImage?.room || story.roomTiles[0]?.roomLabel || null;
  const captionText = story.heroImage?.name || story.subtitle || null;
  const totalRooms = story.roomCount || story.roomTiles.length || 0;

  // Four-row credit block: Rooms / Designer / Photography / Published.
  // Each row appears at most once; rows with no value are dropped entirely.
  const photoNames = Array.from(
    new Set(story.credits.filter((c) => /photo/i.test(c.role)).map((c) => c.name)),
  );
  const stats: Array<{ label: string; value: string }> = [];
  if (totalRooms > 0) stats.push({ label: "Rooms", value: String(totalRooms) });
  if (story.designerName && story.designerName !== "Designer") {
    stats.push({ label: "Designer", value: story.designerName });
  }
  if (photoNames.length > 0) stats.push({ label: "Photography", value: photoNames.join(", ") });
  if (dateLabel) stats.push({ label: "Published", value: dateLabel });

  return (
    <section
      className="mx-auto px-4 md:px-14"
      style={{
        maxWidth: 1168, /* folio-design-system: off-scale */
      }}
    >
      {/* Title row.
          Mobile: flex column — title first, meta strip below as a 3-up row.
          Desktop (md+): 8fr/4fr grid with title left, stats sidebar right
          baselined to bottom (original E4 layout). */}
      <div
        className="flex flex-col gap-4 md:grid md:items-end md:gap-14"
        style={{
          gridTemplateColumns: "8fr 4fr",
        }}
      >
        <h1
          // Font size: mobile uses fluid clamp (~40px floor, 6rem cap at
          // ≥1200px); md+ snaps to the original 60px design-system value.
          // Tailwind arbitrary values land both rules in the cascade so we
          // don't need a media-queried inline style.
          className="[font-size:clamp(2.5rem,8vw,6rem)] md:[font-size:60px] [line-height:1.05] md:[line-height:1.02]"
          style={{
            fontFamily: "var(--font-headline)",
            fontStyle: "italic",
            fontWeight: "var(--w-body)",
            letterSpacing: "-0.012em",
            textWrap: "balance" as any,
            color: "rgba(87, 75, 67, 0.92)",
            margin: 0,
            overflowWrap: "break-word",
          }}
        >
          {story.title}
        </h1>

        {/* Meta block.
            Mobile: horizontal strip of label/value pairs (Rooms · Designer ·
            Published) below the title, above the hero image.
            Desktop: vertical right-column sidebar baselined to title bottom. */}
        <div
          className="flex flex-row flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-x-0 md:gap-y-[14px]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13, /* folio-design-system: off-scale */
            lineHeight: 1.5, /* folio-design-system: off-scale */
            color: "rgba(87, 75, 67, 0.45)",
          }}
        >
          {stats.map((s) => (
            <BylineRow
              key={s.label}
              label={s.label}
              value={s.value}
              // Photography is the longest row and rarely critical on a
              // 360px-wide meta strip; suppressed below md to keep the
              // mobile pattern to Rooms / Designer / Published.
              hideOnMobile={s.label === "Photography"}
            />
          ))}
        </div>
      </div>

      {/* Hero photo — 16:9 cover, flush below the title block.
          Mobile: edge-to-edge via negative margins, square corners.
          Desktop: contained, 12px rounded corners (matches PhotoTile). */}
      <div
        className="-mx-4 md:mx-0 mt-6 md:mt-9 rounded-none md:rounded-[12px]"
        style={{
          aspectRatio: "16 / 9",
          position: "relative",
          overflow: "hidden",
          background: "rgba(87, 75, 67, 0.04)",
        }}
      >
        <Image
          src={story.heroImageUrl}
          alt={story.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1168px"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
      </div>

      {/* Caption row */}
      <div
        className="mt-2 md:mt-[14px]"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 24, /* folio-design-system: off-scale */
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          {heroRoom && (
            <span
              style={{
                fontSize: 10, /* folio-design-system: off-scale */
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(87, 75, 67, 0.55)",
                whiteSpace: "nowrap",
              }}
            >
              {heroRoom}
            </span>
          )}
          {heroRoom && captionText && HERO_DOT}
          {captionText && (
            <span
              className="truncate"
              style={{
                fontSize: 12, /* folio-design-system: off-scale */
                color: "rgba(87, 75, 67, 0.45)",
              }}
            >
              {captionText}
            </span>
          )}
        </div>
        {totalRooms > 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
              fontSize: 10, /* folio-design-system: off-scale */
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "rgba(87, 75, 67, 0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {String(1).padStart(2, "0")} / {String(totalRooms).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Introduction — pull quote + lede paragraph below the caption row,
          same container width, sized for comfortable reading.
          Mobile drops the section gap ~40% so the lede sits closer to the
          hero image and the first scroll lands on body copy. */}
      {(story.projectPullQuote || story.introText) && (
        <div
          className="mt-7 md:mt-12"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24, /* folio-design-system: off-scale */
            maxWidth: 720, /* matches --story-prose-width */
          }}
        >
          {story.projectPullQuote && (
            story.projectPullQuoteIsAttributed ? (
              <blockquote
                style={{
                  fontFamily: "var(--font-headline)",
                  fontStyle: "italic",
                  fontWeight: "var(--w-body)",
                  fontSize: "var(--type-h4)",
                  lineHeight: "var(--lh-body)",
                  color: "rgba(87, 75, 67, 0.85)",
                  margin: 0,
                }}
              >
                &ldquo;{story.projectPullQuote}&rdquo;
                <footer
                  style={{
                    marginTop: 8, /* folio-design-system: off-scale */
                    fontStyle: "normal",
                    fontSize: "var(--type-meta)",
                    color: "rgba(87, 75, 67, 0.55)",
                  }}
                >
                  &mdash; {story.designerName}
                </footer>
              </blockquote>
            ) : (
              <p
                style={{
                  fontFamily: "var(--font-headline)",
                  fontStyle: "italic",
                  fontWeight: "var(--w-body)",
                  fontSize: "var(--type-h4)",
                  lineHeight: "var(--lh-body)",
                  color: "rgba(87, 75, 67, 0.85)",
                  margin: 0,
                }}
              >
                {story.projectPullQuote}
              </p>
            )
          )}
          {story.introText && (
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--type-ui)",
                lineHeight: 1.65, /* folio-design-system: off-scale */
                color: "rgba(87, 75, 67, 0.85)",
                margin: 0,
              }}
            >
              {story.introText}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function BylineRow({
  label,
  value,
  hideOnMobile = false,
}: {
  label: string;
  value: string;
  hideOnMobile?: boolean;
}) {
  return (
    <div
      className={hideOnMobile ? "hidden md:flex" : "flex"}
      style={{ flexDirection: "column", gap: 2 }}
    >
      <span
        style={{
          fontSize: 10, /* folio-design-system: off-scale */
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "rgba(87, 75, 67, 0.55)",
        }}
      >
        {label}
      </span>
      <span style={{ color: "rgba(87, 75, 67, 0.85)" }}>{value}</span>
    </div>
  );
}
