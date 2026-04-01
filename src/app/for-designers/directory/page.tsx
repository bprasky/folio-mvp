import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Sourcebook | FOLIO",
  description: "Every product you tag is attributed to you automatically. Your specification history, structured and searchable in your Sourcebook.",
};

export default function DirectoryPillarPage() {
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
            A sourcebook that builds itself.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            Your specification history, structured and attributed automatically.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[var(--text-primary)] leading-relaxed">
          <p>
            Every product you tag on a published project is attributed to you. Not as a
            manual entry in a separate system &mdash; as a structural record built from your
            actual work. Over time, your tagging history becomes a searchable body of
            specification data: what you use, what you return to, what defines your practice.
          </p>
          <p>
            Most designers have this knowledge locked in their heads or scattered across
            old project files. Folio surfaces it as a living Sourcebook &mdash; organized by
            product category, manufacturer, and project &mdash; that grows every time you publish.
          </p>
          <p>
            This is not a tool you manage. It is a record that forms around you.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Node 1: Photo with tag */}
            <rect x="20" y="40" width="160" height="120" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <rect x="40" y="56" width="80" height="60" rx="8" fill="#EFEBE6" />
            <rect x="100" y="48" width="60" height="28" rx="8" fill="#C9A96E" fillOpacity="0.15" stroke="#C9A96E" strokeWidth="1" />
            <text x="130" y="66" textAnchor="middle" className="fill-[#C9A96E]" fontSize="11" fontWeight="500">Tag</text>
            <text x="100" y="140" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">You tag a product</text>

            {/* Arrow 1 */}
            <line x1="200" y1="100" x2="260" y2="100" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="260,95 272,100 260,105" fill="#C9A96E" />

            {/* Node 2: Product card */}
            <rect x="280" y="40" width="160" height="120" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <rect x="300" y="56" width="40" height="40" rx="6" fill="#EFEBE6" />
            <text x="356" y="72" className="fill-[var(--text-primary)]" fontSize="11" fontWeight="500">Product Name</text>
            <text x="356" y="88" className="fill-[var(--text-secondary)]" fontSize="10">Brand</text>
            <rect x="300" y="104" width="120" height="1" fill="#EFEBE6" />
            <text x="360" y="140" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">It&apos;s attributed to you</text>

            {/* Arrow 2 */}
            <line x1="460" y1="100" x2="520" y2="100" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="520,95 532,100 520,105" fill="#C9A96E" />

            {/* Node 3: Directory grid */}
            <rect x="540" y="40" width="160" height="120" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <rect x="556" y="56" width="56" height="36" rx="4" fill="#EFEBE6" />
            <rect x="618" y="56" width="56" height="36" rx="4" fill="#EFEBE6" />
            <rect x="556" y="98" width="56" height="36" rx="4" fill="#C9A96E" fillOpacity="0.12" />
            <rect x="618" y="98" width="56" height="36" rx="4" fill="#EFEBE6" />
            <text x="620" y="140" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your Sourcebook grows</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
