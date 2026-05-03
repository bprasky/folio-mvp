// `/` — Folio homepage: editorial elevation feed (Task 05).
//
// One curated XL hero, a tight boost reel of products tagged in that
// editorial directly below, then the L/M/S mosaic refresh feed. Same content
// shell for logged-out and logged-in users — chrome and post-hover affordances
// differ. `/magazine` redirects here.
//
// Title and description live on the root layout (src/app/layout.tsx) so they
// carry every route, not just `/`. Don't add a per-page metadata override
// here unless this page genuinely needs to differ from the rest of the site.

import { HomepagePage } from "@/components/homepage/HomepagePage";
import { WelcomeModal } from "@/components/marketing/WelcomeModal";
import { FoundingCTABar } from "@/components/marketing/FoundingCTABar";

// Hero selection involves a window check against `now()`; rendering must not
// be cached at the route level. Inner fetches use their own cache strategy.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <HomepagePage />
      <WelcomeModal />
      <FoundingCTABar />
    </>
  );
}
