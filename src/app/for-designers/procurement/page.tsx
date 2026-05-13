import { Metadata } from "next";
import Link from "next/link";
import { FoundingCohort } from "../sections";

export const metadata: Metadata = {
  title: "Project Procurement | FOLIO",
  description: "Send bulk quote requests grouped by vendor, track responses, and watch your project budget build itself. A procurement timeline tells you what to order and when.",
};

export default function ProcurementPillarPage() {
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
            Pricing, lead times, and deadlines &mdash; from one board.
          </h1>
          <p className="text-lg text-folio-text-secondary leading-relaxed">
            Send bulk quote requests grouped by vendor, track responses, and watch your project budget build itself. A procurement timeline tells you what to order and when.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-8 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <p>
            Interior design procurement is scattered across email chains, spreadsheets, and
            sticky notes. Who quoted what, when does it expire, what&rsquo;s the lead time,
            when do I need to order to make the install date &mdash; the answers to these
            questions live in different places for every vendor on every project.
          </p>
          <p>
            Folio&rsquo;s project board organizes your products by room, with pricing and
            lead time status visible on every card. Select multiple products, send bulk
            quote requests grouped by vendor, and track responses as they come in. When a
            vendor replies with pricing, it attaches directly to the product in your
            project. Your budget summary updates automatically.
          </p>
          <p>
            Set your target install date, and Folio generates a backward-scheduled
            procurement timeline &mdash; showing which items need to be ordered by when
            based on their lead times. No more spreadsheet formulas. No more missed
            deadlines on long-lead items.
          </p>
        </div>
      </section>

      {/* SVG Diagram */}
      <section className="py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <svg viewBox="0 0 720 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            {/* Budget bar at top */}
            <rect x="60" y="16" width="600" height="32" rx="8" fill="#FAF9F6" stroke="var(--folio-gold-ornament)" strokeWidth="1.5" />
            <rect x="64" y="20" width="360" height="24" rx="6" fill="var(--folio-gold-ornament)" fillOpacity="0.2" />
            <text x="360" y="37" textAnchor="middle" className="fill-folio-text-primary" fontSize="11" fontWeight="500">Budget: $42,800 / $65,000</text>

            {/* Room columns */}
            {/* Living Room */}
            <rect x="60" y="64" width="185" height="140" rx="10" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="152" y="86" textAnchor="middle" className="fill-folio-text-primary" fontSize="12" fontWeight="500">Living Room</text>
            <rect x="76" y="96" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="92" cy="110" r="5" fill="#4CAF50" fillOpacity="0.6" />
            <text x="104" y="114" className="fill-[var(--text-secondary)]" fontSize="10">Sofa — $8,200</text>
            <rect x="76" y="130" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="92" cy="144" r="5" fill="#FF9800" fillOpacity="0.6" />
            <text x="104" y="148" className="fill-[var(--text-secondary)]" fontSize="10">Rug — awaiting</text>
            <rect x="76" y="164" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="92" cy="178" r="5" fill="var(--folio-gold-ornament)" fillOpacity="0.4" />
            <text x="104" y="182" className="fill-[var(--text-secondary)]" fontSize="10">Sconces — quoted</text>

            {/* Kitchen */}
            <rect x="267" y="64" width="185" height="140" rx="10" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="359" y="86" textAnchor="middle" className="fill-folio-text-primary" fontSize="12" fontWeight="500">Kitchen</text>
            <rect x="283" y="96" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="299" cy="110" r="5" fill="#4CAF50" fillOpacity="0.6" />
            <text x="311" y="114" className="fill-[var(--text-secondary)]" fontSize="10">Tile — $3,400</text>
            <rect x="283" y="130" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="299" cy="144" r="5" fill="#FF9800" fillOpacity="0.6" />
            <text x="311" y="148" className="fill-[var(--text-secondary)]" fontSize="10">Pendants — awaiting</text>

            {/* Primary */}
            <rect x="475" y="64" width="185" height="140" rx="10" fill="#FAF9F6" stroke="#D4CFC8" strokeWidth="1.5" />
            <text x="567" y="86" textAnchor="middle" className="fill-folio-text-primary" fontSize="12" fontWeight="500">Primary Suite</text>
            <rect x="491" y="96" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="507" cy="110" r="5" fill="var(--folio-gold-ornament)" fillOpacity="0.4" />
            <text x="519" y="114" className="fill-[var(--text-secondary)]" fontSize="10">Bed — quoted</text>
            <rect x="491" y="130" width="153" height="28" rx="6" fill="#EFEBE6" />
            <circle cx="507" cy="144" r="5" fill="#4CAF50" fillOpacity="0.6" />
            <text x="519" y="148" className="fill-[var(--text-secondary)]" fontSize="10">Vanity — $6,100</text>
          </svg>
        </div>
      </section>

      <FoundingCohort />
    </div>
  );
}
