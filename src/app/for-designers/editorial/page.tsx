import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Editorial | FOLIO",
  description: "Upload your photography, walk through a brief interview, and Folio generates a structured editorial post — in your voice, with every product attributed.",
};

export default function EditorialPillarPage() {
  return (
    <div className="bg-[#FAF9F6]">
      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link href="/for-designers" className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors">
          &larr; For Designers
        </Link>
      </div>

      {/* Hero */}
      <section className="pt-12 pb-8 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-headline italic text-5xl md:text-6xl text-folio-text-primary leading-[1.1] mb-6">
            Projects that speak for themselves.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Upload your photography, walk through a brief interview, and Folio generates a structured editorial post &mdash; in your voice, with every product attributed.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Your projects deserve more than a carousel of photos. Folio turns completed
            work into structured editorial content &mdash; the kind of documentation that
            earns press, impresses prospective clients, and builds a permanent record of
            your studio.
          </p>
          <p>
            The process is straightforward. Upload your project photography room by room,
            walk through a brief conversational interview about your design decisions, and
            Folio generates an editorial-quality post built around your actual words. You
            review, refine, and publish. The result reads like a feature in a design
            publication &mdash; because it follows the same structure, just authored by you
            instead of a journalist.
          </p>
          <p>
            Every product visible in your photography can be tagged and attributed. That
            attribution is permanent, searchable, and connected to the vendor ecosystem.
            Your work becomes a living document, not a static portfolio page.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Node 1: Photography stack */}
            <rect x="24" y="44" width="150" height="110" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <rect x="52" y="56" width="64" height="44" rx="6" fill="#EFEBE6" />
            <rect x="46" y="52" width="64" height="44" rx="6" fill="#E8E3DD" />
            <rect x="40" y="48" width="64" height="44" rx="6" fill="#D4CFC8" />
            <text x="99" y="128" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your photos</text>

            {/* Arrow 1 */}
            <line x1="194" y1="100" x2="260" y2="100" stroke="var(--folio-gold-ornament)" strokeWidth="1.5" />
            <polygon points="260,95 272,100 260,105" fill="var(--folio-gold-ornament)" />

            {/* Node 2: Interview */}
            <rect x="280" y="44" width="150" height="110" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <circle cx="355" cy="80" r="20" fill="var(--folio-gold-ornament)" fillOpacity="0.12" stroke="var(--folio-gold-ornament)" strokeWidth="1" />
            <rect x="348" y="72" width="14" height="16" rx="3" fill="var(--folio-gold-ornament)" fillOpacity="0.4" />
            <text x="355" y="128" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your interview</text>

            {/* Arrow 2 */}
            <line x1="450" y1="100" x2="516" y2="100" stroke="var(--folio-gold-ornament)" strokeWidth="1.5" />
            <polygon points="516,95 528,100 516,105" fill="var(--folio-gold-ornament)" />

            {/* Node 3: Editorial post with tagged products */}
            <rect x="536" y="44" width="160" height="110" rx="12" fill="#FAF9F6" stroke="var(--folio-gold-ornament)" strokeWidth="1.5" />
            <rect x="552" y="56" width="128" height="8" rx="2" fill="var(--folio-gold-ornament)" fillOpacity="0.3" />
            <rect x="552" y="70" width="128" height="36" rx="4" fill="#EFEBE6" />
            <rect x="552" y="112" width="80" height="6" rx="2" fill="#D4CFC8" />
            <rect x="638" y="112" width="42" height="6" rx="2" fill="var(--folio-gold-ornament)" fillOpacity="0.4" />
            <rect x="552" y="122" width="100" height="6" rx="2" fill="#E8E3DD" />
            <text x="616" y="148" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your editorial</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
