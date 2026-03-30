import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Clients | FOLIO",
  description: "Folio surfaces clients who align with your taste and practice, before either party has to convince the other.",
};

export default function ClientMatchingPillarPage() {
  return (
    <div className="bg-[#FAF9F6]">
      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link href="/for-designers" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          &larr; For Designers
        </Link>
      </div>

      {/* Hero */}
      <section className="pt-12 pb-8 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-headline italic text-5xl md:text-6xl text-[var(--text-primary)] leading-[1.1] mb-6">
            Find clients whose taste already matches yours.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            The right client relationship starts before the first conversation.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[var(--text-primary)] leading-relaxed">
          <p>
            The most common source of friction in a design engagement isn&rsquo;t budget or
            timeline &mdash; it&rsquo;s misaligned taste. A client who found you through a generic
            search, liked one photo, and projected their expectations onto your practice.
          </p>
          <p>
            Folio builds an intelligence layer from your published work &mdash; the materials
            you use, the spaces you create, the decisions that distinguish your practice.
            As individuals and developers engage with your work on the platform, Folio
            surfaces alignment signals: who is drawn to what you actually do, not just
            what photographs well in a feed.
          </p>
          <p>
            The goal is a match that was already true before either party had to convince
            the other.
          </p>
        </div>
      </section>

      {/* Coming soon badge */}
      <div className="max-w-3xl mx-auto px-6 pb-4">
        <p className="text-sm text-[var(--text-tertiary)] italic">
          Client matching &mdash; coming soon.
        </p>
      </div>

      {/* SVG Diagram — Fingerprint match */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Designer card (left) */}
            <rect x="40" y="20" width="240" height="200" rx="14" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            <circle cx="100" cy="64" r="24" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1" />
            <text x="140" y="56" className="fill-[var(--text-primary)]" fontSize="12" fontWeight="500">Designer</text>
            <text x="140" y="72" className="fill-[var(--text-secondary)]" fontSize="10">Taste profile</text>
            {/* Material tags */}
            <rect x="60" y="100" width="52" height="18" rx="9" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="86" y="113" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Marble</text>
            <rect x="118" y="100" width="40" height="18" rx="9" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="138" y="113" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Oak</text>
            <rect x="164" y="100" width="48" height="18" rx="9" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="188" y="113" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Brass</text>
            {/* Color swatches */}
            <rect x="60" y="128" width="18" height="18" rx="4" fill="#D4CFC8" />
            <rect x="82" y="128" width="18" height="18" rx="4" fill="#C9A96E" fillOpacity="0.3" />
            <rect x="104" y="128" width="18" height="18" rx="4" fill="#8F8A84" fillOpacity="0.4" />
            {/* Style bars */}
            <rect x="60" y="158" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="60" y="158" width="160" height="5" rx="2.5" fill="#C9A96E" fillOpacity="0.3" />
            <rect x="60" y="170" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="60" y="170" width="120" height="5" rx="2.5" fill="#C9A96E" fillOpacity="0.25" />
            <rect x="60" y="182" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="60" y="182" width="180" height="5" rx="2.5" fill="#C9A96E" fillOpacity="0.2" />
            <text x="160" y="210" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Your taste fingerprint</text>

            {/* Match icon (center) */}
            <circle cx="360" cy="120" r="28" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1.5" />
            <text x="360" y="116" textAnchor="middle" className="fill-[#C9A96E]" fontSize="20">&#x2194;</text>
            <text x="360" y="136" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9" fontWeight="500">Match</text>

            {/* Client card (right) */}
            <rect x="440" y="20" width="240" height="200" rx="14" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <circle cx="500" cy="64" r="24" fill="#EFEBE6" stroke="#D4CFC8" strokeWidth="1" />
            <text x="540" y="56" className="fill-[var(--text-primary)]" fontSize="12" fontWeight="500">Client</text>
            <text x="540" y="72" className="fill-[var(--text-secondary)]" fontSize="10">Project brief</text>
            {/* Brief tags */}
            <rect x="460" y="100" width="52" height="18" rx="9" fill="#EFEBE6" stroke="#D4CFC8" strokeWidth="0.75" />
            <text x="486" y="113" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">Marble</text>
            <rect x="518" y="100" width="40" height="18" rx="9" fill="#EFEBE6" stroke="#D4CFC8" strokeWidth="0.75" />
            <text x="538" y="113" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">Oak</text>
            <rect x="564" y="100" width="56" height="18" rx="9" fill="#EFEBE6" stroke="#D4CFC8" strokeWidth="0.75" />
            <text x="592" y="113" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="9">Warm</text>
            {/* Color swatches */}
            <rect x="460" y="128" width="18" height="18" rx="4" fill="#D4CFC8" />
            <rect x="482" y="128" width="18" height="18" rx="4" fill="#C9A96E" fillOpacity="0.25" />
            <rect x="504" y="128" width="18" height="18" rx="4" fill="#8F8A84" fillOpacity="0.3" />
            {/* Style bars */}
            <rect x="460" y="158" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="460" y="158" width="150" height="5" rx="2.5" fill="#D4CFC8" fillOpacity="0.4" />
            <rect x="460" y="170" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="460" y="170" width="110" height="5" rx="2.5" fill="#D4CFC8" fillOpacity="0.35" />
            <rect x="460" y="182" width="200" height="5" rx="2.5" fill="#EFEBE6" />
            <rect x="460" y="182" width="170" height="5" rx="2.5" fill="#D4CFC8" fillOpacity="0.3" />
            <text x="560" y="210" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Their preferences</text>

            {/* Bottom label */}
            <text x="360" y="248" textAnchor="middle" className="fill-[var(--text-tertiary)]" fontSize="11">Alignment signals surface automatically</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
