// src/app/feed/ui/side.tsx

import Link from "next/link";
import { getTrendingProjects } from "@/lib/feed/getTrendingProjects";
import { getAISuggestions } from "@/lib/feed/getAISuggestions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { GlassCard } from "@/components/ui/glass";

export async function SideTrending() {
  const trending = await getTrendingProjects();

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-medium text-neutral-700">Trending Projects This Week</h4>
      {trending.length > 0 ? (
        trending.map((item) => (
          <TrendingTile
            key={item.id}
            title={item.project.title ?? "Untitled Project"}
            imageUrl={item.project.imageUrl}
            href={`/p/${item.slug}`}
          />
        ))
      ) : (
        <>
          <OutlineTile label="Trending card" />
          <OutlineTile label="Trending card" />
        </>
      )}
    </section>
  );
}

export async function SideAISuggested() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const suggestions = await getAISuggestions(userId);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-neutral-700">Folio AI: Suggested Matches</h4>
        <span className="text-[10px] uppercase tracking-wide text-neutral-400">Labs</span>
      </div>
      {suggestions.length > 0 ? (
        suggestions.map((item) => (
          <TrendingTile
            key={item.id}
            title={item.project.title ?? "Untitled Project"}
            imageUrl={item.project.imageUrl}
            href={`/p/${item.slug}`}
          />
        ))
      ) : (
        <>
          <OutlineTile label="AI suggestion (for your Smith project)" />
          <OutlineTile label="AI suggestion (materials match)" />
        </>
      )}
    </section>
  );
}

function TrendingTile({
  title,
  imageUrl,
  href,
}: {
  title: string;
  imageUrl: string | null;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <GlassCard variant="default" padding="none" rounded="2xl" className="overflow-hidden hover:shadow-xl transition-shadow duration-300">
        <div className="relative aspect-[4/5] w-full overflow-hidden">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gray-100">
              <span className="text-xs text-gray-400">No image</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-xs font-medium text-white line-clamp-2">{title}</p>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

function OutlineTile({ label }: { label: string }) {
  return (
    <GlassCard variant="subtle" padding="none" rounded="2xl" className="overflow-hidden">
      <div className="aspect-[4/5] w-full bg-gray-100/50 grid place-items-center">
        <span className="text-xs text-gray-400">{label}</span>
      </div>
    </GlassCard>
  );
}

