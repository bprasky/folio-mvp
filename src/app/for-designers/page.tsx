import { Metadata } from "next";
import {
  ForDesignersHero,
  HowItWorks,
  WhatYouGet,
  FoundingCohort,
} from "./sections";

export const metadata: Metadata = {
  title: "For Designers | FOLIO",
  description:
    "Folio is where interior designers publish completed projects as structured, documented records. Apply to join the founding cohort.",
};

export default function ForDesignersPage() {
  return (
    <>
      <ForDesignersHero />
      <HowItWorks />
      <WhatYouGet />
      <FoundingCohort />
    </>
  );
}
