// /magazine/community — preserved magazine page content (Task 05)
//
// `/magazine` itself now redirects to the homepage at `/`. This sub-route
// keeps the legacy MagazinePage layout (mosaic + GatheringVoicesSection +
// PromptedQuestionsSection + editions UI) reachable for direct linking.

import MagazinePage from "@/components/magazine/MagazinePage";
import { WelcomeModal } from "@/components/marketing/WelcomeModal";
import { FoundingCTABar } from "@/components/marketing/FoundingCTABar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams?: { edition?: string };
}

export default async function Page({ searchParams }: PageProps) {
  const edition = searchParams?.edition || "for-you";
  return (
    <>
      <MagazinePage editionSlug={edition} />
      <WelcomeModal />
      <FoundingCTABar />
    </>
  );
}
