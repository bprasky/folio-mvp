"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const slowFade = {
  ...fade,
  transition: { duration: 0.8, ease: "easeOut" },
};

export function AboutPageContent() {
  return (
    <div className="bg-[#FAF9F6]">
      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="font-headline italic text-5xl md:text-6xl lg:text-7xl text-folio-text-primary leading-[var(--lh-h1)]">
            Your work, properly published.
          </h1>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-6">
        <hr className="border-t border-folio-border-subtle" />
      </div>

      {/* Body 1 */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            Folio is the new portfolio. Every project you publish becomes an
            editorial page: written, structured, hosted at a real URL. The kind
            of treatment you&rsquo;d otherwise hire a PR firm for.
          </motion.p>
        </div>
      </section>

      {/* Pull quote 1 */}
      <section className="py-12 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          {...slowFade}
        >
          <hr className="border-t border-folio-border-subtle mb-10 max-w-xs mx-auto" />
          <p className="font-headline italic text-3xl md:text-4xl text-folio-text-primary leading-snug">
            The press kit, the portfolio, and the publication.
          </p>
          <hr className="border-t border-folio-border-subtle mt-10 max-w-xs mx-auto" />
        </motion.div>
      </section>

      {/* Body 2 */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            The editorial comes from you. Folio reviews your work, past
            projects, and bio, then asks the questions a reporter who just met
            you couldn&rsquo;t ask. Questions that pull the story out of the
            work. You answer in your own words. Folio handles the layout, the
            asset packaging, and the polish.
          </motion.p>
          <motion.p {...fade}>
            What lives at the end of that flow is a structured page with your
            name on it: products specified, rooms documented, your voice on the
            page. Send it to a client. Link it from a pitch. Post it to
            Instagram with assets already sized for it.
          </motion.p>
        </div>
      </section>

      {/* Pull quote 2 */}
      <section className="py-12 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          {...slowFade}
        >
          <hr className="border-t border-folio-border-subtle mb-10 max-w-xs mx-auto" />
          <p className="font-headline italic text-3xl md:text-4xl text-folio-text-primary leading-snug">
            Built for reference, not for the algorithm.
          </p>
          <hr className="border-t border-folio-border-subtle mt-10 max-w-xs mx-auto" />
        </motion.div>
      </section>

      {/* Body 3 + 4 */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            Past work that used to live in PDFs and dead links lives in your
            sourcebook: searchable, citable, attributed. Every room, every
            product, every detail you&rsquo;ve published becomes referenceable
            across your career.
          </motion.p>
          <motion.p {...fade}>
            Folio is currently onboarding its founding designer cohort. If you
            do meaningful work and want a platform built around the integrity
            of that work, we&rsquo;d like to talk.
          </motion.p>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-6">
        <hr className="border-t border-folio-border-subtle" />
      </div>

      {/* CTA */}
      <section className="py-20 px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          {...slowFade}
        >
          <div className="glass-surface rounded-2xl p-10 md:p-14">
            <p className="font-headline italic text-3xl md:text-4xl text-folio-text-primary mb-8">
              We&rsquo;d like to talk.
            </p>
            <Link
              href="/for-designers#apply"
              className="accent-btn inline-block px-8 py-3.5 text-base"
            >
              Apply to Join
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
