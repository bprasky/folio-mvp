import type { Metadata } from "next";
import { AboutPageContent } from "./content";

export const metadata: Metadata = {
  title: "About | FOLIO",
  description: "Turn your projects and the thinking behind them into a shareable designer profile, built to help future clients discover your work through search and AI.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
