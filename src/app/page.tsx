import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import MagazinePage from "@/components/magazine/MagazinePage";
import {
  ForDesignersHero,
  HowItWorks,
  WhyFolio,
  FoundingCohort,
} from "@/app/for-designers/sections";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <>
        <ForDesignersHero />
        <HowItWorks />
        <WhyFolio />
        <FoundingCohort />
      </>
    );
  }

  return <MagazinePage editionSlug="for-you" />;
}