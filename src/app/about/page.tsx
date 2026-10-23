import type { Metadata } from "next";
import { AboutPageContent } from "./content";

export const metadata: Metadata = {
  title: "About | FOLIO",
  description:
    "Good design deserves to be published. Turn your projects and the thinking behind them into your studio’s own publication, with Folio’s project-informed interviews, editorial features and social content.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
