import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Your Editorial | FOLIO",
  description: "Editorial-quality content generated from your project, in your voice. Posts that keep working.",
};

export default function EditorialPillarPage() {
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
            Posts that keep working.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
            Editorial-quality content generated from your project, in your voice.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[var(--text-primary)] leading-relaxed">
          <p>
            When you publish a project on Folio, the platform generates a structured
            editorial feature built around your photography and your interview responses.
            Room by room. Product by product. In your words, not a template.
          </p>
          <p>
            That content belongs to you. It can anchor a client pitch, support a press
            inquiry, or simply stand as the professional record your work deserves. It
            doesn&rsquo;t expire when an algorithm moves on.
          </p>
          <p>
            Most designers create their best work and then scramble to document it. Folio
            inverts that &mdash; the documentation happens as a natural output of publishing,
            not as a separate project.
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
            <text x="99" y="128" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your photography</text>

            {/* Arrow 1 */}
            <line x1="194" y1="100" x2="260" y2="100" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="260,95 272,100 260,105" fill="#C9A96E" />

            {/* Node 2: Interview */}
            <rect x="280" y="44" width="150" height="110" rx="12" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <circle cx="355" cy="80" r="20" fill="#C9A96E" fillOpacity="0.12" stroke="#C9A96E" strokeWidth="1" />
            <rect x="348" y="72" width="14" height="16" rx="3" fill="#C9A96E" fillOpacity="0.4" />
            <text x="355" y="128" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your interview</text>

            {/* Arrow 2 */}
            <line x1="450" y1="100" x2="516" y2="100" stroke="#C9A96E" strokeWidth="1.5" />
            <polygon points="516,95 528,100 516,105" fill="#C9A96E" />

            {/* Node 3: Editorial post */}
            <rect x="536" y="44" width="160" height="110" rx="12" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            <rect x="552" y="56" width="128" height="8" rx="2" fill="#D4CFC8" />
            <rect x="552" y="70" width="128" height="36" rx="4" fill="#EFEBE6" />
            <rect x="552" y="112" width="80" height="6" rx="2" fill="#D4CFC8" />
            <rect x="552" y="122" width="100" height="6" rx="2" fill="#E8E3DD" />
            <text x="616" y="148" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Your editorial</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
