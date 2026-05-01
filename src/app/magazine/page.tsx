// `/magazine` redirects to `/` per Task 05 routing decision.
//
// The new homepage at `/` is the editorial elevation feed (XL hero + boost
// reel + L/M/S mosaic). The legacy MagazinePage layout is preserved at
// `/magazine/community` so deep-links from emails, newsletters, and
// MagazineCoverHero deeper-content sections still resolve.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MagazineRedirect() {
  redirect("/");
}
