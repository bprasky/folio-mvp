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
        <h1 className="font-headline italic text-5xl md:text-6xl lg:text-7xl text-folio-text-primary leading-[1.1]">
          Your work is the product. Folio treats it that way.
        </h1>
        <motion.p
          className="mt-8 text-lg md:text-xl text-folio-text-secondary leading-relaxed max-w-2xl mx-auto"
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
          <p className="uppercase tracking-widest text-sm text-folio-text-secondary mb-3">
            The Process
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-folio-text-primary mb-14">
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
                <h3 className="text-lg font-medium text-folio-text-primary mb-3">
                  {step.title}
                </h3>
                <p className="text-folio-text-secondary leading-relaxed">
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

const pillarCards = [
  {
    label: "Your Specifications",
    title: "A directory that builds itself",
    description: "Every product you tag is attributed to you automatically \u2014 no manual entry, no separate portfolio management.",
    href: "/for-designers/directory",
  },
  {
    label: "Your Editorial",
    title: "Posts that keep working",
    description: "Every project generates editorial-quality content built around your voice \u2014 owned content you can deploy to clients, press, and your network.",
    href: "/for-designers/editorial",
  },
  {
    label: "Your Identity",
    title: "A bio that evolves with your work",
    description: "Your Folio bio adapts as you publish, surfacing your actual taste fingerprint based on what you specify and build.",
    href: "/for-designers/bio",
  },
  {
    label: "Your Credit",
    title: "Get credited for what you specify",
    description: "When your tagged products are discovered and specified by others, that contribution is attributed back to you.",
    href: "/for-designers/attribution",
  },
  {
    label: "Your Clients",
    title: "Find clients whose taste already matches yours",
    description: "Folio builds an intelligence layer around your published work and uses it to surface clients who already align with what you do.",
    href: "/for-designers/client-matching",
  },
];

export function WhatYouGet() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-folio-text-secondary mb-3">
            What You Get
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-folio-text-primary mb-14">
            Built around your work. Not theirs.
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillarCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              className={i === 4 ? "lg:col-span-3 lg:max-w-md lg:mx-auto" : ""}
            >
              <GlassCard
                variant="default"
                padding="lg"
                rounded="xl"
                className="border border-stone-200/60 h-full flex flex-col"
              >
                <p className="uppercase tracking-widest text-xs text-folio-text-secondary mb-2">
                  {card.label}
                </p>
                <h3 className="font-headline italic text-xl text-folio-text-primary mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-folio-text-secondary leading-relaxed mb-4 flex-1">
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                >
                  Learn more &rarr;
                </Link>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FoundingCohort() {
  return (
    <section id="apply" className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-folio-text-secondary mb-3">
            Founding Designers
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-folio-text-primary mb-10">
            We&rsquo;re building the founding cohort now.
          </h2>
        </motion.div>

        <motion.p
          className="text-folio-text-primary leading-relaxed mb-6"
          {...fade}
        >
          Folio is invite-only during its founding phase. Founding designers
          receive permanent recognition on the platform and structural
          advantages that don&rsquo;t go away as the platform grows.
        </motion.p>

        <motion.div {...slowFade}>
          <div className="glass-surface rounded-2xl p-10 md:p-14 mt-10">
            <p className="font-headline italic text-2xl md:text-3xl text-folio-text-primary mb-3">
              If your work is ready, so are we.
            </p>
            <p className="text-folio-text-secondary leading-relaxed mb-8">
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
