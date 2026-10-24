// src/app/feed/page.tsx

import { Suspense } from "react";
import Link from "next/link";

import { getPublishedProjectPosts } from "@/lib/feed/getPublishedProjectPosts";
import { getRecentProjectModules } from "@/lib/feed/getRecentProjectModules";
import { getUpdatesCarousel } from "@/lib/feed/getUpdatesCarousel";
import { FeedContentSkeleton } from "./skeleton";
import { LoadingSurface } from "@/components/loading/LoadingBrand";
import { EmptyFeedOutline } from "./states";
import { FeedHeroCard, FeedGridCard } from "./ui/cards";
import { SideTrending, SideAISuggested } from "./ui/side";
import { UpdatesFeed } from "@/components/feed/UpdatesFeed";
import { UpdatesCarousel } from "@/components/feed/UpdatesCarousel";

export const revalidate = 30; // light ISR for demo safety

function FeaturedFeed({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return <EmptyFeedOutline />;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main */}
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

      {/* Side */}
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
    <div className="min-h-screen bg-surface-ground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <header className="mb-8">
          <h1 className="folio-h1 mb-4">
            Discover
          </h1>
          <p className="folio-body text-folio-text-secondary max-w-2xl">
            Explore projects from designers around the world
          </p>
        </header>

        {/* Mode toggle */}
        <div className="flex gap-3 text-sm mb-8">
          <Link
            href="/feed?mode=featured"
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              mode === "featured"
                ? "bg-[var(--accent)] text-white shadow-[var(--neu-raised)]"
                : "bg-surface-ground text-folio-text-secondary border border-folio-border-subtle hover:bg-surface-canvas"
            }`}
          >
            Featured Projects
          </Link>
          <Link
            href="/feed?mode=updates"
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              mode === "updates"
                ? "bg-[var(--accent)] text-white shadow-[var(--neu-raised)]"
                : "bg-surface-ground text-folio-text-secondary border border-folio-border-subtle hover:bg-surface-canvas"
            }`}
          >
            Stories & Updates
          </Link>
        </div>

        <Suspense fallback={<LoadingSurface label="Loading Discover stories"><FeedContentSkeleton updates={mode === "updates"} /></LoadingSurface>}>
          {mode === "featured" ? (
            <div className="space-y-8">
              {/* Updates Carousel (always show, skeleton when empty) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="folio-ui text-folio-text-secondary uppercase tracking-wide">Updates</h2>
                  <span className="folio-meta text-folio-text-tertiary">Short clips & stories from ongoing projects</span>
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
      </div>
    </div>
  );
}
