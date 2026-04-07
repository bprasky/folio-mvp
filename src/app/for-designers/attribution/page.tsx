import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Credit | FOLIO",
  description: "When your tagged products are discovered and specified by others, that contribution is attributed back to you.",
};

export default function AttributionPillarPage() {
  return (
    <div className="bg-surface-ground">
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
            Get credited for what you specify.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Your expertise drives demand. Folio makes sure that flows back to you.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Designers have always been the hidden force behind product discovery. A
            material gets specified on one project, a client notices it, a colleague
            asks about it, and suddenly a product has momentum &mdash; with no record of
            where it started.
          </p>
          <p>
            Folio closes that loop. When your tagged products are discovered and
            engaged with by others on the platform, that activity is attributed back to
            the designer who specified it first. Your taste becomes a traceable origin
            point, not an invisible input.
          </p>
          <p>
            This is early infrastructure for a future where the specification credit
            designers have always deserved is formally recognized &mdash; and rewarded.
          </p>
        </div>
      </section>

      {/* Coming soon badge */}
      <div className="max-w-3xl mx-auto px-6 pb-4">
        <p className="text-sm text-folio-text-tertiary italic">
          Full attribution rewards &mdash; coming soon.
        </p>
      </div>

      {/* SVG Diagram — Attribution loop */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-sm mx-auto">
            {/* Node 1: Designer tags (top) */}
            <rect x="120" y="20" width="160" height="56" rx="12" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1.5" />
            <text x="200" y="44" textAnchor="middle" className="fill-[var(--text-primary)]" fontSize="12" fontWeight="500">Designer tags product</text>
            <text x="200" y="60" textAnchor="middle" className="fill-[#C9A96E]" fontSize="10">You</text>

            {/* Arrow: top → right */}
            <path d="M280 56 Q340 56 340 120" stroke="#C9A96E" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />

            {/* Node 2: Product in feed (right) */}
            <rect x="270" y="140" width="120" height="56" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="330" y="164" textAnchor="middle" className="fill-[var(--text-primary)]" fontSize="11" fontWeight="500">Product appears</text>
            <text x="330" y="180" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">in feed</text>

            {/* Arrow: right → bottom */}
            <path d="M330 196 Q330 260 280 280" stroke="#C9A96E" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />

            {/* Node 3: Someone discovers (bottom) */}
            <rect x="120" y="268" width="160" height="56" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="200" y="292" textAnchor="middle" className="fill-[var(--text-primary)]" fontSize="11" fontWeight="500">Someone discovers</text>
            <text x="200" y="308" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">&amp; specifies it</text>

            {/* Arrow: bottom → left */}
            <path d="M120 280 Q60 260 60 196" stroke="#C9A96E" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />

            {/* Node 4: Credit flows back (left) */}
            <rect x="10" y="140" width="120" height="56" rx="12" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1.5" />
            <text x="70" y="164" textAnchor="middle" className="fill-[var(--text-primary)]" fontSize="11" fontWeight="500">Credit flows</text>
            <text x="70" y="180" textAnchor="middle" className="fill-[#C9A96E]" fontSize="10">back to you</text>

            {/* Arrow: left → top */}
            <path d="M70 140 Q60 56 120 40" stroke="#C9A96E" strokeWidth="1.5" fill="none" markerEnd="url(#arrowhead)" />

            {/* Arrow marker definition */}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#C9A96E" />
              </marker>
            </defs>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
