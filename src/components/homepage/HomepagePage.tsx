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

  return (
    <div className="bg-surface-canvas min-h-screen pb-24">
      {/* Filter chip row — directly under the global nav */}
      <div className="border-b border-folio-border-subtle">
        <div className="max-w-[1440px] mx-auto px-10 py-4">
          <HomepageFilterChips isOut={isOut} />
        </div>
      </div>

      {/* Editorial XL hero */}
      {data.hero && (
        <section className="pt-8">
          <HomepageHeroXL hero={data.hero} />
        </section>
      )}

      {/* Boost reel — tethered 16px below the hero */}
      {data.hero && data.reel.items.length > 0 && (
        <section className="px-10 mt-4 max-w-[1440px] mx-auto">
          <BoostReel
            items={data.reel.items}
            totalTagged={data.reel.totalTagged}
            postSlug={data.hero.postSlug}
          />
        </section>
      )}

      {/* L/M/S mosaic feed */}
      <section
        className={`px-10 max-w-[1440px] mx-auto ${data.hero ? "mt-12" : "mt-8"}`}
      >
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
