import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Directory & Discovery | FOLIO",
  description: "Your published work, product expertise, and client reviews build a professional presence in Folio's Directory — discoverable by location, style, and the products you specify.",
};

export default function DiscoveryPillarPage() {
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
            A presence that compounds.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Your published work, product expertise, and client reviews build a professional presence in Folio&rsquo;s Directory &mdash; discoverable by location, style, and the products you specify.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Every project you publish, every product you tag, and every editorial post you
            create contributes to your presence in the Folio Directory. Clients and fellow
            professionals can discover you by location, design style, and project type. Your
            profile isn&rsquo;t a static bio &mdash; it&rsquo;s a living reflection of your work.
          </p>
          <p>
            Your Atelier fingerprint &mdash; a composite of your aesthetic patterns, material
            preferences, and design approach &mdash; evolves automatically as you publish.
            Clients searching for a designer whose taste matches theirs find you through this
            fingerprint, not through paid placement. Merit-based positioning means your
            visibility reflects the quality and consistency of your work.
          </p>
          <p>
            Attribution is permanent. When you tag a product in a project, that specification
            is credited to you across the platform. Vendors see which designers are moving
            their products. Clients see the products you actually use. Your professional
            credibility builds with every project you document.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Designer profile card */}
            <rect x="40" y="20" width="220" height="180" rx="14" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            <circle cx="150" cy="60" r="24" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1" />
            <text x="150" y="104" textAnchor="middle" className="fill-folio-text-primary" fontSize="13" fontWeight="500">Studio Name</text>
            <text x="150" y="120" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Modern Warmth · New York</text>
            <rect x="80" y="136" width="50" height="18" rx="4" fill="#EFEBE6" />
            <text x="105" y="149" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">12 projects</text>
            <rect x="138" y="136" width="80" height="18" rx="4" fill="#EFEBE6" />
            <text x="178" y="149" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">148 products</text>
            <rect x="70" y="164" width="120" height="6" rx="2" fill="#C9A96E" fillOpacity="0.3" />

            {/* Arrow to published project */}
            <line x1="270" y1="80" x2="320" y2="80" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="320,75 332,80 320,85" fill="#C9A96E" />

            {/* Published project */}
            <rect x="340" y="20" width="180" height="120" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <rect x="356" y="32" width="148" height="48" rx="6" fill="#EFEBE6" />
            <text x="430" y="100" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Published Project</text>
            <text x="430" y="116" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">Tagged products →</text>

            {/* Arrow to sourcebook */}
            <line x1="430" y1="150" x2="430" y2="170" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="425,170 430,182 435,170" fill="#C9A96E" />

            {/* Sourcebook snippet */}
            <rect x="340" y="186" width="180" height="28" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="430" y="205" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Sourcebook attribution</text>

            {/* Arrow back to profile */}
            <path d="M340 200 L150 200 L150 200" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="150" y1="200" x2="150" y2="200" stroke="#C9A96E" strokeWidth="1" />

            {/* Reputation label */}
            <rect x="560" y="50" width="130" height="60" rx="10" fill="#C9A96E" fillOpacity="0.08" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <text x="625" y="76" textAnchor="middle" style={{ fill: "#C9A96E" }} fontSize="11" fontWeight="500">Reputation</text>
            <text x="625" y="94" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">grows with every project</text>
            <line x1="530" y1="80" x2="556" y2="80" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
