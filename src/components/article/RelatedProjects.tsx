"use client";

import Link from "next/link";

type RelatedProject = {
  id: string;
  slug: string;
  project: {
    title: string;
    images: Array<{ url: string | null }>;
  };
};

export function RelatedProjects({
  items,
}: {
  items: RelatedProject[];
}) {
  if (!items?.length) return null;

  return (
    <section className="mt-16">
      <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
        In Collaboration With
      </h3>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((p) => {
          const imageUrl =
            p.project.images?.[0]?.url ||
            p.project.images?.find((img) => img.url)?.url ||
            "/placeholder.png";

          return (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="group rounded-2xl ring-1 ring-black/5 overflow-hidden bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)] transition"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={p.project.title}
                className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="p-3">
                <p className="line-clamp-2 folio-meta text-[var(--text-primary)]">
                  {p.project.title}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


