import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | FOLIO",
  description:
    "Design work deserves a better home. Folio is a professional platform where designers publish their work with editorial quality and proper attribution.",
};

export default function AboutPage() {
  return (
    <div className="bg-[#FAF9F6]">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-headline italic text-5xl md:text-6xl text-[var(--text-primary)] leading-tight">
            Design work deserves a better home.
          </h1>
        </div>
      </section>

      {/* Body */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[var(--text-primary)] leading-relaxed">
          <p>
            For too long, the interior design industry has operated across a
            patchwork of Instagram posts, PDF portfolios, shared Dropbox folders,
            and word-of-mouth. Exceptional work gets published once, credited
            loosely, and then disappears into a feed.
          </p>
          <p>Folio exists to fix that.</p>
          <p>
            We built Folio as a professional platform where designers can publish
            their work the way it deserves to be published &mdash; with editorial
            quality, proper attribution, and a permanent record that travels with
            the project, not against the algorithm.
          </p>
          <p>
            Every project published on Folio becomes part of a structured,
            searchable body of work. The products specified. The rooms
            documented. The designer credited. Nothing lost to a scroll.
          </p>
          <p>
            We started with designers because they are the center of gravity for
            everything that happens in this industry. Their decisions shape
            spaces, specify products, and define what good looks like. We think
            their work should be treated accordingly.
          </p>
          <p>
            Folio is currently onboarding its founding designer cohort. If you do
            meaningful work and want a platform built around the integrity of
            that work &mdash; we&rsquo;d like to talk.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="font-headline italic text-2xl text-[var(--text-primary)] mb-6">
            We&rsquo;d like to talk.
          </p>
          <Link
            href="/for-designers#apply"
            className="accent-btn inline-block px-6 py-3"
          >
            Apply to Join
          </Link>
        </div>
      </section>
    </div>
  );
}
