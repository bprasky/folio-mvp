// HomepageFilterChips — simple chip row for the homepage feed (Task 05)
//
// Tabs: All work, Following (signed-in only), Recent, Region, Category.
// Active = ink-fill chip. Single-select; clicking active chip clears.
//
// Filter changes update the URL query params; HomepageMosaicSection reacts via
// router events. No full-page reload.

"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
  isOut: boolean;
}

const STATIC_CHIPS: { id: string; label: string; query: Record<string, string | null> }[] = [
  { id: "all",      label: "All work", query: { filter: null, following: null } },
  { id: "recent",   label: "Recent",   query: { filter: "recent", following: null } },
  { id: "region",   label: "Region",   query: { filter: "region", following: null } },
  { id: "category", label: "Category", query: { filter: "category", following: null } },
];

export function HomepageFilterChips({ isOut }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeFilter = params.get("filter");
  const followingActive = params.get("following") === "true";

  const setQuery = (next: Record<string, string | null>) => {
    const newParams = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) newParams.delete(k);
      else newParams.set(k, v);
    }
    const queryString = newParams.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  };

  const isActive = (chipId: string): boolean => {
    if (chipId === "following") return followingActive;
    if (chipId === "all") return !activeFilter && !followingActive;
    return activeFilter === chipId && !followingActive;
  };

  return (
    <nav
      aria-label="Filter homepage feed"
      // Mobile: horizontal scroll with momentum, no visible scrollbar, no
      // wrap (chips overflow off the right edge to imply scrollability).
      // Desktop (sm+): wrap onto multiple rows like the original layout.
      className="flex items-center gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0"
      data-pending={isPending ? "true" : undefined}
    >
      <Chip
        label="All work"
        active={isActive("all")}
        onClick={() => setQuery({ filter: null, following: null })}
      />
      {!isOut && (
        <Chip
          label="Following"
          active={isActive("following")}
          onClick={() => setQuery({ filter: null, following: followingActive ? null : "true" })}
        />
      )}
      {STATIC_CHIPS.filter((c) => c.id !== "all").map((chip) => (
        <Chip
          key={chip.id}
          label={chip.label}
          active={isActive(chip.id)}
          onClick={() => setQuery(chip.query)}
        />
      ))}
    </nav>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full transition-colors folio-ui bg-folio-ink text-folio-bg"
          : "shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full transition-colors folio-ui bg-transparent text-folio-text-secondary hover:bg-surface-ground hover:text-folio-text-primary"
      }
    >
      {label}
    </button>
  );
}
