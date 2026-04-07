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
    <div className="bg-surface-ground">
      {/* Hero */}
      <section className="pt-28 pb-16 px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="font-headline italic text-5xl md:text-6xl lg:text-7xl text-folio-text-primary leading-[1.1]">
            Design work deserves a better home.
          </h1>
        </motion.div>
      </section>

      {/* Divider */}
      <div className="max-w-3xl mx-auto px-6">
        <hr className="border-t border-folio-border-subtle" />
      </div>

      {/* Prose block 1: The problem */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            For too long, the interior design industry has operated across a
            patchwork of Instagram posts, PDF portfolios, shared Dropbox folders,
            and word-of-mouth. Exceptional work gets published once, credited
            loosely, and then disappears into a feed.
          </motion.p>
        </div>
      </section>

      {/* Pull quote */}
      <section className="py-12 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          {...slowFade}
        >
          <hr className="border-t border-folio-border-subtle mb-10 max-w-xs mx-auto" />
          <p className="font-headline italic text-3xl md:text-4xl text-folio-text-primary leading-snug">
            Folio exists to fix that.
          </p>
          <hr className="border-t border-folio-border-subtle mt-10 max-w-xs mx-auto" />
        </motion.div>
      </section>

      {/* Prose block 2: What Folio does */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            We built Folio as a professional platform where designers can publish
            their work the way it deserves to be published &mdash; with editorial
            quality, proper attribution, and a permanent record that travels with
            the project, not against the algorithm.
          </motion.p>
          <motion.p {...fade}>
            Every project published on Folio becomes part of a structured,
            searchable body of work. The products specified. The rooms
            documented. The designer credited.
          </motion.p>
        </div>
      </section>

      {/* Emphasized line */}
      <section className="py-8 px-6">
        <motion.div className="max-w-3xl mx-auto" {...slowFade}>
          <p className="font-headline italic text-2xl md:text-3xl text-[var(--accent)] leading-snug">
            Nothing lost to a scroll.
          </p>
        </motion.div>
      </section>

      {/* Prose block 3: Why designers */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-folio-text-primary leading-relaxed">
          <motion.p {...fade}>
            We started with designers because they are the center of gravity for
            everything that happens in this industry. Their decisions shape
            spaces, specify products, and define what good looks like. We think
            their work should be treated accordingly.
          </motion.p>
          <motion.p {...fade}>
            Folio is currently onboarding its founding designer cohort. If you do
            meaningful work and want a platform built around the integrity of
            that work &mdash; we&rsquo;d like to talk.
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
