"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";

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

export function ForDesignersHero() {
  return (
    <section className="pt-28 pb-20 px-6 bg-[#FAF9F6]">
      <motion.div
        className="max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1 className="font-headline italic text-5xl md:text-6xl lg:text-7xl text-[var(--text-primary)] leading-[1.1]">
          Your work is the product. Folio treats it that way.
        </h1>
        <motion.p
          className="mt-8 text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          Folio is where interior designers publish completed projects as structured, documented records.
        </motion.p>
      </motion.div>
    </section>
  );
}

const steps = [
  {
    title: "Upload your photography",
    description:
      "Bring in the images from your completed project, room by room.",
  },
  {
    title: "Tell the story",
    description:
      "A brief interview walks you through the decisions, the brief, and the details that don\u2019t make it into the photos.",
  },
  {
    title: "Folio does the rest",
    description:
      "Your project is structured into a professional post \u2014 your name, your products, your voice attached to every room.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
            The Process
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-14">
            How it works
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.15,
                ease: "easeOut",
              }}
            >
              <GlassCard
                variant="default"
                padding="lg"
                rounded="xl"
                className="border border-stone-200/60 h-full"
              >
                <p className="font-headline italic text-3xl text-[var(--accent)] mb-3">
                  {i + 1}
                </p>
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-3">
                  {step.title}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhyFolio() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
            Why Folio
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-10">
            Start with what you&rsquo;ve earned.
          </h2>
        </motion.div>

        <motion.p
          className="text-[var(--text-primary)] leading-relaxed mb-6"
          {...fade}
        >
          Most platforms start with what they need from you. Reach without
          attribution. Leads without polish. Engagement without record.
        </motion.p>

        <motion.p
          className="text-[var(--text-primary)] leading-relaxed mb-6"
          {...fade}
        >
          Folio starts with what you&rsquo;ve earned. A polished, permanent
          showcase of your work. Your story, told room by room. And full
          credit for every high-end material and product decision that made the
          project what it is.
        </motion.p>

        {/* Emphasized closing */}
        <motion.div className="py-8" {...slowFade}>
          <hr className="border-t border-[var(--ridge-outer)] mb-8 max-w-xs" />
          <p className="font-headline italic text-2xl md:text-3xl text-[var(--accent)] leading-snug">
            Your taste is documented. Your name is attached.
            <br />
            Your work doesn&rsquo;t disappear.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export function FoundingCohort() {
  return (
    <section id="apply" className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
            Founding Designers
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-10">
            We&rsquo;re building the founding cohort now.
          </h2>
        </motion.div>

        <motion.p
          className="text-[var(--text-primary)] leading-relaxed mb-6"
          {...fade}
        >
          Folio is invite-only during its founding phase. Founding designers
          receive permanent recognition on the platform and structural
          advantages that don&rsquo;t go away as the platform grows.
        </motion.p>

        <motion.div {...slowFade}>
          <div className="glass-surface rounded-2xl p-10 md:p-14 mt-10">
            <p className="font-headline italic text-2xl md:text-3xl text-[var(--text-primary)] mb-3">
              If your work is ready, so are we.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mb-8">
              Apply to join Folio&rsquo;s founding designer cohort and help shape
              the platform from the ground up.
            </p>
            <Link
              href="/auth/signup"
              className="accent-btn inline-block px-8 py-3.5 text-base"
            >
              Apply to Join
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
