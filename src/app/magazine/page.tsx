// src/app/magazine/page.tsx
//
// AUDIT SUMMARY (from feed implementation):
// - Old feed lived at: src/app/feed/page.tsx
// - Data models used:
//   * ProjectPost (PUBLISHED status, with project relation)
//   * Project (with designer, images, ProductTag relations)
//   * Product (via ProductTag on ProjectImage)
//   * Designer/User (via project.designer relation)
// - Components reused:
//   * FeedHeroCard, FeedGridCard (from src/app/feed/ui/cards.tsx) - NOT reusing, building new editorial hero
//   * FlowMosaic, EventMosaic (from src/components/feed/FlowMosaic.tsx, src/components/events/EventMosaic.tsx)
//     - Can reference for mosaic grid patterns, but building magazine-specific version
//   * UpdatesCarousel (from src/components/feed/UpdatesCarousel.tsx) - may reuse for product rail
// - Data fetching helpers:
//   * getPublishedProjectPosts (src/lib/feed/getPublishedProjectPosts.ts) - fetches ProjectPost with PUBLISHED status
//   * Uses Prisma: projectPost.findMany with status: "PUBLISHED", includes project.designer, project.images
//   * Hero image comes from heroAssetId or first project image
// - Navigation: Currently /feed in Navigation.tsx line 48, label "Home"

import MagazinePage from "@/components/magazine/MagazinePage";
import { WelcomeModal } from "@/components/marketing/WelcomeModal";
import { FoundingCTABar } from "@/components/marketing/FoundingCTABar";

// Force dynamic rendering to prevent caching of product data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MagazinePageProps {
  searchParams?: {
    edition?: string;
  };
}

export default async function Page({ searchParams }: MagazinePageProps) {
  const edition = searchParams?.edition || "for-you";

  return (
    <>
      <MagazinePage editionSlug={edition} />
      <WelcomeModal />
      <FoundingCTABar />
    </>
  );
}

