import { Metadata } from "next";
import { AboutPageContent } from "./content";

export const metadata: Metadata = {
  title: "About | FOLIO",
  description:
    "Your work, properly published. Folio turns every project into an editorial page — written, structured, and hosted at a real URL.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
