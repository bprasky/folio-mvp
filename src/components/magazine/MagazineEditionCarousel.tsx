"use client";

// src/components/magazine/MagazineEditionCarousel.tsx
//
// Edition Selector - Subtle Pills/Tabs
//
// Positioned between Zone 1 (Editorial) and Zone 2 (Mosaic).
// Serves as "table of contents" for the mosaic feed below.
// Style as subtle pills, not a heavy bar.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type MagazineEditionConfig } from "@/lib/magazine/editions";
import clsx from "clsx";

interface Props {
  editions: MagazineEditionConfig[];
  activeSlug: string;
}

export default function MagazineEditionCarousel({ editions, activeSlug }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (slug: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("edition", slug);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
      {editions.map((edition) => {
        const isActive = edition.slug === activeSlug;

        return (
          <button
            key={edition.slug}
            onClick={() => handleSelect(edition.slug)}
            className={clsx(
              "folio-ui px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-full",
              isActive
                ? "ridge-btn text-[var(--text-primary)] bg-[var(--bg-elevated)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 border border-transparent"
            )}
          >
            {edition.label}
          </button>
        );
      })}
    </div>
  );
}

