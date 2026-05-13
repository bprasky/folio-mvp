// Homepage Editorial Elevation Feed — server orchestrator (Task 05)
//
// Reads the session once, fetches homepage data, and passes (user, isOut, data)
// down to the children. No useSession() — auth-state branches happen here so
// the rendered HTML is final and there's no hydration flicker between
// "logged-out shell" and "logged-in shell" above the editorial hero.

import { auth } from "@/lib/auth";
import { getHomepageData } from "@/lib/homepage/getHomepageData";

import { HomepageHeroXL } from "./HomepageHeroXL";
import { BoostReel } from "./BoostReel";
import { HomepageFilterChips } from "./HomepageFilterChips";
import { HomepageMosaicSection } from "./HomepageMosaicSection";
import { InviteRibbon } from "./InviteRibbon";

export async function HomepagePage() {
  const session = await auth();
  const user = session?.user ?? null;
  const isOut = !user;

  const data = await getHomepageData({ userId: user?.id ?? null });

  // Mobile vs desktop edge padding:
  //   - Mobile (<sm): 16px side padding, tighter vertical rhythm so the
  //     hero sits closer to the section above and the InviteRibbon doesn't
  //     push content off-screen.
  //   - Desktop (sm+): 40px side padding (matches existing magazine spacing
  //     tokens), generous vertical rhythm.
  // pb-32 on mobile gives the InviteRibbon clearance + iOS safe-area room.
  return (
    <div className="bg-surface-canvas min-h-screen pb-32 sm:pb-24">
      {/* Editorial XL hero */}
      {data.hero && (
        <section className="pt-4 sm:pt-8">
          <HomepageHeroXL hero={data.hero} />
        </section>
      )}

      {/* Boost reel — tethered 16px below the hero on desktop, 12px on mobile */}
      {data.hero && data.reel.items.length > 0 && (
        <section className="px-4 sm:px-10 mt-3 sm:mt-4 max-w-[1440px] mx-auto">
          <BoostReel
            items={data.reel.items}
            totalTagged={data.reel.totalTagged}
            postSlug={data.hero.postSlug}
          />
        </section>
      )}

      {/* Filter chip row — sits directly above the mosaic feed it controls. */}
      <div
        className={`border-y border-folio-border-subtle ${data.hero ? "mt-8 sm:mt-12" : "mt-6 sm:mt-8"}`}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-10 py-3 sm:py-4">
          <HomepageFilterChips isOut={isOut} />
        </div>
      </div>

      {/* L/M/S mosaic feed */}
      <section className="px-4 sm:px-10 max-w-[1440px] mx-auto mt-6 sm:mt-8">
        <HomepageMosaicSection
          initialPosts={data.feedPosts}
          initialNextCursor={data.nextCursor}
          isOut={isOut}
        />
      </section>

      {/* Invite ribbon — sticky bottom, logged-out only */}
      {isOut && <InviteRibbon />}
    </div>
  );
}
