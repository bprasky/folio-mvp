import { Metadata } from "next";
import Link from "next/link";
import { AboutPageContent } from "./content";

export const metadata: Metadata = {
  title: "About | FOLIO",
  description:
    "Design work deserves a better home. Folio is a professional platform where designers publish their work with editorial quality and proper attribution.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
