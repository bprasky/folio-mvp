"use client";

// src/components/magazine/FilterTabs.tsx
//
// Filter Tabs for Magazine Feed
//
// Provides filtering between:
// - All (projects + features)
// - Projects (Posted Projects with editorial status)
// - Features (all feature types: material studies, methods, profiles, etc.)

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

export type MagazineFilter = "all" | "projects" | "features";

interface FilterTabsProps {
  activeFilter: MagazineFilter;
  className?: string;
}

const FILTERS: { value: MagazineFilter; label: string; description: string }[] = [
  { value: "all", label: "All", description: "Everything" },
  { value: "projects", label: "Projects", description: "Featured projects" },
  { value: "features", label: "Features", description: "Editorial features" },
];

export default function FilterTabs({ activeFilter, className }: FilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (filter: MagazineFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  };

  return (
    <div className={clsx("flex items-center gap-1", className)}>
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => handleFilterChange(filter.value)}
          className={clsx(
            "px-4 py-2 text-sm font-medium rounded-full transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2",
            activeFilter === filter.value
              ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/60"
              : "bg-transparent text-neutral-600 hover:bg-white/50 hover:text-neutral-900"
          )}
          title={filter.description}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
