import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Sourcebook | FOLIO",
  description: "Your Sourcebook builds itself as you tag products across projects. Request samples, get quotes, check availability — all from one place.",
};

export default function SourcebookPillarPage() {
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
          <h1 className="font-headline italic text-5xl md:text-6xl text-folio-text-primary leading-[var(--lh-h1)] mb-6">
            Every product you&rsquo;ve ever specified, organized.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Your Sourcebook builds itself as you tag products across projects. Request samples, get quotes, check availability &mdash; with structured actions that work whether or not the vendor is on Folio.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Designers maintain sourcebooks &mdash; curated references of the vendors,
            products, and materials they specify from. The problem is that these live
            across spreadsheets, bookmarks, and memory. Folio builds your Sourcebook
            automatically from the products you tag in projects.
          </p>
          <p>
            Every product in your Sourcebook has actionable next steps. Request a sample,
            get a quote, check availability, or add it to another project &mdash; all from
            one place. When the vendor has a rep on Folio, the request goes directly to
            their inbox. When they don&rsquo;t, Folio generates a professional email you
            can send with one click. Either way, you have a structured record of every
            request you&rsquo;ve made and every response you&rsquo;ve received.
          </p>
          <p>
            Your Sourcebook crosses projects. A product you specified two years ago is
            still there, with notes, pricing history, and the rep you worked with last
            time. It&rsquo;s your personal catalog of everything you&rsquo;ve ever worked
            with, searchable and sortable by vendor, category, or project.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Sourcebook card */}
            <rect x="220" y="20" width="280" height="80" rx="12" fill="#FAF9F6" stroke="var(--folio-gold-ornament)" strokeWidth="1.5" />
            <text x="360" y="48" textAnchor="middle" className="fill-folio-text-primary" fontSize="14" fontWeight="500">Sourcebook Product Card</text>
            <rect x="240" y="60" width="60" height="6" rx="2" fill="#D4CFC8" />
            <rect x="308" y="60" width="80" height="6" rx="2" fill="#D4CFC8" />
            <rect x="240" y="72" width="100" height="6" rx="2" fill="#E8E3DD" />

            {/* Action buttons radiating outward */}
            {/* Request Sample */}
            <rect x="40" y="150" width="130" height="36" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="105" y="173" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Request Sample</text>
            <line x1="170" y1="168" x2="280" y2="120" stroke="var(--folio-gold-ornament)" strokeWidth="1" strokeDasharray="4 3" />

            {/* Request Quote */}
            <rect x="200" y="170" width="130" height="36" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="265" y="193" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Request Quote</text>
            <line x1="290" y1="170" x2="320" y2="120" stroke="var(--folio-gold-ornament)" strokeWidth="1" strokeDasharray="4 3" />

            {/* Use in Project */}
            <rect x="380" y="170" width="130" height="36" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="445" y="193" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Use in Project</text>
            <line x1="420" y1="170" x2="400" y2="120" stroke="var(--folio-gold-ornament)" strokeWidth="1" strokeDasharray="4 3" />

            {/* Check Availability */}
            <rect x="550" y="150" width="140" height="36" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="620" y="173" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Check Availability</text>
            <line x1="550" y1="168" x2="440" y2="120" stroke="var(--folio-gold-ornament)" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
