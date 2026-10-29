"use client";

// One publication surface, from the gated cover through every room.

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildStoryData } from "@/lib/story/buildRoomTiles";
import { ImmersiveRooms } from "./ImmersiveRooms";
import { ProductSheet } from "./ProductSheet";

interface StoryRendererProps {
  post: any;
}

export function StoryRenderer({ post }: StoryRendererProps) {
  return <Publication key={post.id ?? post.slug ?? post.project?.id} post={post} />;
}

function Publication({ post }: StoryRendererProps) {
  const searchParams = useSearchParams();
  const [activeProduct, setActiveProduct] = useState<any | null>(null);

  const [entered, setEntered] = useState(false);
  const handleEntered = useCallback(() => setEntered(true), []);

  // Build story data from post
  const story = useMemo(() => buildStoryData(post), [post]);

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
    if (entered && autoProductId && story) {
      for (const room of story.roomTiles) {
        const product = room.products.find((p: any) => p.id === autoProductId);
        if (product) {
          setActiveProduct(product);
          break;
        }
      }
    }
  }, [entered, autoProductId, story]);

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
    <div id="tagged-products" data-publication-view="immersive" className="w-full scroll-mt-20">
      <ImmersiveRooms
        story={story}
        projectName={post.project.title}
        presentation={post.expandedBlocks?.presentation}
        onProductClick={handleProductClick}
        autoExpandRoom={autoExpandRoom}
        onEntered={handleEntered}
      />

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
