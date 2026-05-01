// `/` — Folio homepage: editorial elevation feed (Task 05).
//
// One curated XL hero, a tight boost reel of products tagged in that
// editorial directly below, then the L/M/S mosaic refresh feed. Same content
// shell for logged-out and logged-in users — chrome and post-hover affordances
// differ. `/magazine` redirects here.

import type { Metadata } from "next";

import { HomepagePage } from "@/components/homepage/HomepagePage";

export const metadata: Metadata = {
  title: "Folio — Interior design, in detail",
  description:
    "A working magazine for interior designers. Editorial features, materials, and the studios shaping them.",
};

// Hero selection involves a window check against `now()`; rendering must not
// be cached at the route level. Inner fetches use their own cache strategy.
export const dynamic = "force-dynamic";

export default function Home() {
  return <HomepagePage />;
}
