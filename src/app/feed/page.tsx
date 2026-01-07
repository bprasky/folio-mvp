// src/app/feed/page.tsx

import { Suspense } from "react";
import Link from "next/link";

import { getPublishedProjectPosts } from "@/lib/feed/getPublishedProjectPosts";
import { getRecentProjectModules } from "@/lib/feed/getRecentProjectModules";
import { getUpdatesCarousel } from "@/lib/feed/getUpdatesCarousel";
import { FeedSkeleton } from "./skeleton";
import { EmptyFeedOutline } from "./states";
import { FeedHeroCard, FeedGridCard } from "./ui/cards";
import { SideTrending, SideAISuggested } from "./ui/side";
import { UpdatesFeed } from "@/components/feed/UpdatesFeed";
import { UpdatesCarousel } from "@/components/feed/UpdatesCarousel";
import { PageContainer, EditorialHeadline } from "@/components/ui/glass";

export const revalidate = 30; // light ISR for demo safety

function FeaturedFeed({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return <EmptyFeedOutline />;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main (≈80%) */}
      <section className="col-span-12 lg:col-span-9 space-y-6">
        {/* Hero = first post */}
        <FeedHeroCard post={posts[0]} />

        {/* Below hero: up to 2 more posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.slice(1, 3).map((p) => (
            <FeedGridCard key={p.id} post={p} />
          ))}
        </div>
      </section>

      {/* Side (≈20%) */}
      <aside className="col-span-12 lg:col-span-3 space-y-6">
        <SideTrending />
        <SideAISuggested />
      </aside>
    </div>
  );
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { mode?: string };
}) {
  const mode = searchParams.mode === "updates" ? "updates" : "featured";

  const [posts, modules, updates] = await Promise.all([
    mode === "featured" ? getPublishedProjectPosts({ take: 6 }) : Promise.resolve([]),
    mode === "updates" ? getRecentProjectModules() : Promise.resolve([]),
    mode === "featured" ? getUpdatesCarousel(12, 5) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <PageContainer size="xl" padding="lg">
        {/* Page Header */}
        <header className="mb-8">
          <EditorialHeadline size="xl" className="mb-4">
            Discover
          </EditorialHeadline>
          <p className="text-lg text-gray-600 max-w-2xl">
            Explore projects from designers around the world
          </p>
        </header>

        {/* Mode toggle */}
        <div className="flex gap-3 text-sm mb-8">
          <Link
            href="/feed?mode=featured"
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              mode === "featured"
                ? "bg-blue-600 text-white"
                : "bg-white/70 text-gray-700 border border-gray-200/70 hover:bg-white/90"
            }`}
          >
            Featured Projects
          </Link>
          <Link
            href="/feed?mode=updates"
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              mode === "updates"
                ? "bg-blue-600 text-white"
                : "bg-white/70 text-gray-700 border border-gray-200/70 hover:bg-white/90"
            }`}
          >
            Stories & Updates
          </Link>
        </div>

        <Suspense fallback={<FeedSkeleton />}>
          {mode === "featured" ? (
            <div className="space-y-8">
              {/* Updates Carousel (always show, skeleton when empty) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">Updates</h2>
                  <span className="text-xs text-gray-500">Short clips & stories from ongoing projects</span>
                </div>
                <UpdatesCarousel groups={updates} />
              </section>

              {/* Existing "minted" editorial feed (unchanged) */}
              <FeaturedFeed posts={posts} />
            </div>
          ) : (
            <UpdatesFeed modules={modules} />
          )}
        </Suspense>
      </PageContainer>
    </div>
  );
}

