import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Unified Communications | FOLIO",
  description: "Vendor emails, rep texts, contractor updates — all linked to the right project and the right product. Your whole team's communications, searchable and organized.",
};

export default function CommunicationsPillarPage() {
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
            Every conversation, every channel, one place.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Vendor emails, rep texts, contractor updates &mdash; all linked to the right project and the right product. Your whole team&rsquo;s communications, searchable and organized.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            A single project might involve emails with six vendors, text threads with two
            reps, WhatsApp messages from the contractor, and phone calls with the showroom.
            When someone asks &ldquo;where are we on the kitchen tile?&rdquo; the answer
            requires searching four apps across three people&rsquo;s phones.
          </p>
          <p>
            Folio is the single hub for all project communication. Emails sent through
            Folio are tracked and linked to the product and project they belong to. Replies
            come back into Folio with pricing and lead times automatically extracted. Texts
            and WhatsApp messages can be forwarded in. Call notes can be logged. Everything
            is sortable by project, vendor, team member, or message type.
          </p>
          <p>
            At the firm level, every team member&rsquo;s communications roll up into one
            view. The principal can see the complete communication record for any project
            without asking anyone to forward anything. Nothing gets lost in someone&rsquo;s
            personal inbox.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Channel icons on the left */}
            {/* Email */}
            <rect x="40" y="16" width="100" height="32" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="90" y="37" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Email</text>

            {/* Text / SMS */}
            <rect x="40" y="60" width="100" height="32" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="90" y="81" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Text / SMS</text>

            {/* WhatsApp */}
            <rect x="40" y="104" width="100" height="32" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="90" y="125" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">WhatsApp</text>

            {/* Phone */}
            <rect x="40" y="148" width="100" height="32" rx="8" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="90" y="169" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="11">Phone</text>

            {/* Folio */}
            <rect x="40" y="192" width="100" height="32" rx="8" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            <text x="90" y="213" textAnchor="middle" style={{ fill: "#C9A96E" }} fontSize="11" fontWeight="500">Folio</text>

            {/* Converging arrows */}
            <line x1="150" y1="32" x2="280" y2="110" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="150" y1="76" x2="280" y2="110" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="150" y1="120" x2="280" y2="110" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="150" y1="164" x2="280" y2="110" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />
            <line x1="150" y1="208" x2="280" y2="110" stroke="#C9A96E" strokeWidth="1" strokeDasharray="4 3" />

            {/* Unified inbox */}
            <rect x="290" y="40" width="390" height="140" rx="14" fill="#FAF9F6" stroke="#C9A96E" strokeWidth="1.5" />
            <text x="485" y="68" textAnchor="middle" className="fill-folio-text-primary" fontSize="13" fontWeight="500">Unified Inbox</text>

            {/* Filter tabs */}
            <rect x="320" y="80" width="70" height="22" rx="6" fill="#C9A96E" fillOpacity="0.15" />
            <text x="355" y="95" textAnchor="middle" style={{ fill: "#C9A96E" }} fontSize="10">Project</text>
            <rect x="398" y="80" width="70" height="22" rx="6" fill="#EFEBE6" />
            <text x="433" y="95" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Vendor</text>
            <rect x="476" y="80" width="56" height="22" rx="6" fill="#EFEBE6" />
            <text x="504" y="95" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Team</text>
            <rect x="540" y="80" width="70" height="22" rx="6" fill="#EFEBE6" />
            <text x="575" y="95" textAnchor="middle" className="fill-[var(--text-secondary)]" fontSize="10">Channel</text>

            {/* Message rows */}
            <rect x="320" y="112" width="330" height="20" rx="4" fill="#EFEBE6" />
            <rect x="320" y="138" width="330" height="20" rx="4" fill="#EFEBE6" />
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
