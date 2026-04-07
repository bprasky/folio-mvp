import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Identity | FOLIO",
  description: "Your Folio bio adapts as you publish, surfacing your actual taste fingerprint based on what you specify and build.",
};

export default function BioPillarPage() {
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
            A bio that evolves with your work.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Your professional identity, built from what you actually do.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Most designer bios are written once and quietly go stale. A paragraph that
            captured who you were two practices ago, still sitting on your website.
          </p>
          <p>
            Your Folio bio adapts. As you publish, the platform builds a taste fingerprint
            from your actual specification history &mdash; the materials you return to, the
            spatial decisions that define your work, the aesthetic patterns that emerge
            across projects. That fingerprint surfaces on your profile and updates as your
            body of work does.
          </p>
          <p>
            You don&rsquo;t write your Folio bio. You build it, one published project at a time.
          </p>
        </div>
      </section>

      {/* SVG Diagram — Static vs Adaptive */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Left: Static bio */}
            <rect x="40" y="20" width="280" height="160" rx="14" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" opacity="0.6" />
            <rect x="64" y="44" width="232" height="8" rx="3" fill="#D4CFC8" opacity="0.5" />
            <rect x="64" y="60" width="200" height="8" rx="3" fill="#D4CFC8" opacity="0.4" />
            <rect x="64" y="76" width="216" height="8" rx="3" fill="#D4CFC8" opacity="0.35" />
            <rect x="64" y="92" width="180" height="8" rx="3" fill="#D4CFC8" opacity="0.3" />
            <rect x="64" y="108" width="160" height="8" rx="3" fill="#D4CFC8" opacity="0.25" />
            <text x="180" y="152" textAnchor="middle" className="fill-[var(--text-tertiary)]" fontSize="12" fontWeight="500">Written once</text>

            {/* Divider */}
            <line x1="360" y1="30" x2="360" y2="170" stroke="#D4CFC8" strokeWidth="1" strokeDasharray="4 4" />

            {/* Right: Adaptive profile */}
            <rect x="400" y="20" width="280" height="160" rx="14" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            {/* Profile circle */}
            <circle cx="440" cy="56" r="20" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1" />
            {/* Material tags */}
            <rect x="472" y="40" width="56" height="20" rx="10" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="500" y="54" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Marble</text>
            <rect x="534" y="40" width="48" height="20" rx="10" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="558" y="54" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Oak</text>
            <rect x="588" y="40" width="56" height="20" rx="10" fill="#C9A96E" fillOpacity="0.1" stroke="#C9A96E" strokeWidth="0.75" />
            <text x="616" y="54" textAnchor="middle" className="fill-[#C9A96E]" fontSize="9">Brass</text>
            {/* Color swatches */}
            <rect x="472" y="68" width="20" height="20" rx="4" fill="#D4CFC8" />
            <rect x="496" y="68" width="20" height="20" rx="4" fill="#C9A96E" fillOpacity="0.3" />
            <rect x="520" y="68" width="20" height="20" rx="4" fill="#8F8A84" fillOpacity="0.4" />
            <rect x="544" y="68" width="20" height="20" rx="4" fill="#B8845C" fillOpacity="0.4" />
            {/* Style indicators */}
            <rect x="420" y="100" width="240" height="6" rx="3" fill="#EFEBE6" />
            <rect x="420" y="100" width="180" height="6" rx="3" fill="#C9A96E" fillOpacity="0.3" />
            <rect x="420" y="114" width="240" height="6" rx="3" fill="#EFEBE6" />
            <rect x="420" y="114" width="140" height="6" rx="3" fill="#C9A96E" fillOpacity="0.25" />
            <rect x="420" y="128" width="240" height="6" rx="3" fill="#EFEBE6" />
            <rect x="420" y="128" width="200" height="6" rx="3" fill="#C9A96E" fillOpacity="0.2" />
            <text x="540" y="158" textAnchor="middle" className="fill-[#C9A96E]" fontSize="12" fontWeight="500">Built from your work</text>

            {/* Labels */}
            <text x="180" y="204" textAnchor="middle" className="fill-[var(--text-tertiary)]" fontSize="11">Traditional bio</text>
            <text x="540" y="204" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Folio profile</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
