"use client";

// StoryRenderer — Top-level orchestrator for the Folio Story Format.
// Composes: StoryHero → StoryIntro → Mosaic → StoryCredits.
// Manages ProductSheet state and deep link routing.

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildStoryData } from "@/lib/story/buildRoomTiles";
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
      className="min-h-screen"
      style={{ background: "#FFFCF8" }}
    >
      <div className="mx-auto max-w-[1200px] py-6 md:py-10">
        {/* Hero: Full-width, clean, above the fold */}
        <StoryHero imageUrl={story.heroImageUrl} alt={story.title} />

        {/* Introduction: below hero, visible above the fold */}
        <StoryIntro story={story} />

        {/* Mosaic: Room grid with expand-to-detail */}
        <div className="mt-10">
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
