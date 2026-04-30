"use client";

import { useState } from "react";
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
          Your story told right. Your studio run right.
        </h1>
        <motion.p
          className="mt-8 text-lg md:text-xl text-folio-text-secondary leading-relaxed max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          Folio is where interior designers publish their work, source
          their products, and turn vendor conversations into action.
          Built for the way studios already operate.
        </motion.p>
      </motion.div>
    </section>
  );
}

const frames = [
  {
    videoBase: "/onboarding/01-published-project",
    headline: "Your portfolio, working for you",
    body: "Folio turns your projects into editorial articles that publish to your profile, your directory page, and your magazine feed. The portfolio section of your website becomes a publication that keeps writing itself.",
  },
  {
    videoBase: "/onboarding/02-interview-moment",
    headline: "Folio asks questions a reporter can't",
    body: "Every project starts with an interview that goes deeper than any journalist would. Your answers become editorial in your voice, under your name. You talk, Folio writes.",
  },
  {
    videoBase: "/onboarding/03-sourcebook-fills",
    headline: "Your Sourcebook fills itself",
    body: "Every product you tag while publishing becomes part of your Sourcebook. Search, filter, and reference everything you've ever speced. Your past work becomes the reference library for your next project.",
  },
];

function FrameVideo({ videoBase }: { videoBase: string }) {
  const [videoError, setVideoError] = useState(false);

  if (videoError) {
    return <div className="w-full aspect-[16/10] rounded-xl warm-mesh" />;
  }

  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setVideoError(true)}
      className="w-full aspect-[16/10] object-cover rounded-xl"
    >
      <source src={`${videoBase}.webm`} type="video/webm" />
      <source src={`${videoBase}.mp4`} type="video/mp4" />
    </video>
  );
}

export function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto">
        <motion.div {...fade}>
          <p className="uppercase tracking-widest text-sm text-folio-text-secondary mb-3">
            What Folio Does
          </p>
          <h2 className="font-headline italic text-4xl md:text-5xl text-folio-text-primary mb-14">
            Built for the way studios already operate
          </h2>
        </motion.div>
        <div className="flex flex-col gap-20 md:gap-28">
          {frames.map((frame, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`flex flex-col md:flex-row md:items-center gap-8 md:gap-12 ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="w-full md:w-1/2">
                <FrameVideo videoBase={frame.videoBase} />
              </div>
              <div className="w-full md:w-1/2">
                <h3 className="font-headline italic text-3xl md:text-4xl text-folio-text-primary leading-[1.15] mb-4">
                  {frame.headline}
                </h3>
                <p className="text-folio-text-secondary leading-relaxed">
                  {frame.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const pillarCards = [
  {
    label: "Your Editorial",
    title: "Projects that speak for themselves.",
    description:
      "Upload your photography, walk through a brief interview, and Folio generates a structured editorial post \u2014 in your voice, with every product attributed. Professional documentation of your work, without the writing.",
    href: "/for-designers/editorial",
  },
  {
    label: "Your Products",
    title: "Every product you\u2019ve ever specified, organized.",
    description:
      "Your Sourcebook builds itself as you tag products across projects. Request samples, get quotes, check availability \u2014 with structured actions that work whether or not the vendor is on Folio.",
    href: "/for-designers/sourcebook",
  },
  {
    label: "Your Budget",
    title: "Pricing, lead times, and deadlines \u2014 from one board.",
    description:
      "Send bulk quote requests grouped by vendor, track responses, and watch your project budget build itself. A procurement timeline tells you what to order and when.",
    href: "/for-designers/procurement",
  },
  {
    label: "Your Communications",
    title: "Every conversation, every channel, one place.",
    description:
      "Vendor emails, rep texts, contractor updates \u2014 all linked to the right project and the right product. Your whole team\u2019s communications, searchable and organized.",
    href: "/for-designers/communications",
  },
  {
    label: "Your Reputation",
    title: "A presence that compounds.",
    description:
      "Your published work, product expertise, and client reviews build a professional presence in Folio\u2019s Directory \u2014 discoverable by location, style, and the products you specify.",
    href: "/for-designers/discovery",
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
            One platform for the whole studio.
          </h2>
        </motion.div>
        <div className="flex flex-wrap justify-center gap-6">
          {pillarCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
              className="w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
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
