"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const SESSION_KEY = "folio-landing-seen";

const pillars = [
  { label: "Your Specifications", title: "A directory that builds itself", href: "/for-designers/directory" },
  { label: "Your Editorial", title: "Posts that keep working", href: "/for-designers/editorial" },
  { label: "Your Identity", title: "A bio that evolves with your work", href: "/for-designers/bio" },
  { label: "Your Credit", title: "Get credited for what you specify", href: "/for-designers/attribution" },
  { label: "Your Clients", title: "Find clients whose taste already matches yours", href: "/for-designers/client-matching" },
];

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

const container = {
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function LandingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") return;
    if (status === "loading") return;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setIsOpen(true);
    }
  }, [status]);

  function handleClose() {
    setIsOpen(false);
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 pointer-events-none"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="pointer-events-auto glass-overlay flex flex-col w-full max-w-4xl max-h-[92vh] rounded-[20px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 border-b border-[rgba(190,175,155,0.24)] bg-[rgba(255,252,248,0.95)] backdrop-blur-md">
                <span className="font-headline text-xl tracking-wide font-semibold text-folio-text-primary">
                  FOLIO
                </span>
                <button
                  onClick={handleClose}
                  className="p-2 -mr-2 rounded-full hover:bg-black/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-folio-text-secondary" />
                </button>
              </div>

              {/* Scrollable content */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overscroll-contain"
              >
                <motion.div
                  variants={container}
                  initial="initial"
                  animate="animate"
                >
                  {/* Hero */}
                  <motion.div variants={item} className="px-8 md:px-12 pt-12 pb-8">
                    <h2 className="font-headline italic text-3xl md:text-4xl lg:text-5xl text-folio-text-primary leading-[1.1] text-center">
                      Your work is the product.
                      <br />
                      Folio treats it that way.
                    </h2>
                    <p className="mt-5 text-center text-base md:text-lg text-folio-text-secondary leading-relaxed max-w-xl mx-auto">
                      Folio is where interior designers publish completed projects
                      as structured, documented records.
                    </p>
                  </motion.div>

                  {/* Divider */}
                  <div className="px-8 md:px-12">
                    <hr className="border-t border-folio-border-subtle" />
                  </div>

                  {/* How it works */}
                  <motion.div variants={item} className="px-8 md:px-12 py-10">
                    <p className="uppercase tracking-widest text-xs text-folio-text-secondary mb-2">
                      The Process
                    </p>
                    <h3 className="font-headline italic text-2xl md:text-3xl text-folio-text-primary mb-8">
                      How it works
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {steps.map((step, i) => (
                        <GlassCard
                          key={i}
                          variant="subtle"
                          padding="md"
                          rounded="xl"
                          className="border border-stone-200/60"
                        >
                          <p className="font-headline italic text-2xl text-[var(--accent)] mb-2">
                            {i + 1}
                          </p>
                          <h4 className="text-sm font-medium text-folio-text-primary mb-1.5">
                            {step.title}
                          </h4>
                          <p className="text-sm text-folio-text-secondary leading-relaxed">
                            {step.description}
                          </p>
                        </GlassCard>
                      ))}
                    </div>
                  </motion.div>

                  {/* Divider */}
                  <div className="px-8 md:px-12">
                    <hr className="border-t border-folio-border-subtle" />
                  </div>

                  {/* What You Get */}
                  <motion.div variants={item} className="px-8 md:px-12 py-10">
                    <p className="uppercase tracking-widest text-xs text-folio-text-secondary mb-2">
                      What You Get
                    </p>
                    <h3 className="font-headline italic text-2xl md:text-3xl text-folio-text-primary mb-6">
                      Built around your work. Not theirs.
                    </h3>
                    <div className="space-y-3">
                      {pillars.map((pillar, i) => (
                        <Link
                          key={i}
                          href={pillar.href}
                          onClick={handleClose}
                          className="flex items-baseline gap-3 group py-2 border-b border-folio-border-subtle last:border-b-0 transition-colors hover:bg-black/[0.02] -mx-2 px-2 rounded-lg"
                        >
                          <span className="uppercase tracking-widest text-[10px] text-folio-text-tertiary whitespace-nowrap min-w-[100px]">
                            {pillar.label}
                          </span>
                          <span className="font-headline italic text-base text-folio-text-primary group-hover:text-[var(--accent)] transition-colors">
                            {pillar.title}
                          </span>
                          <span className="text-folio-text-tertiary text-sm ml-auto shrink-0">&rarr;</span>
                        </Link>
                      ))}
                    </div>
                  </motion.div>

                  {/* Divider */}
                  <div className="px-8 md:px-12">
                    <hr className="border-t border-folio-border-subtle" />
                  </div>

                  {/* Founding cohort */}
                  <motion.div variants={item} className="px-8 md:px-12 py-10 pb-6">
                    <p className="uppercase tracking-widest text-xs text-folio-text-secondary mb-2">
                      Founding Designers
                    </p>
                    <h3 className="font-headline italic text-2xl md:text-3xl text-folio-text-primary mb-6">
                      We&rsquo;re building the founding cohort now.
                    </h3>
                    <div className="space-y-4 text-folio-text-primary leading-relaxed text-[15px]">
                      <p>
                        Folio is invite-only during its founding phase. Founding
                        designers receive permanent recognition on the platform and
                        structural advantages that don&rsquo;t go away as the
                        platform grows.
                      </p>
                      <p className="font-medium">
                        If your work is ready, so are we.
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Sticky footer */}
              <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 px-8 py-5 border-t border-[rgba(190,175,155,0.24)] bg-[rgba(255,252,248,0.95)] backdrop-blur-md">
                <Link
                  href="/auth/signin"
                  onClick={handleClose}
                  className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                >
                  Already have an account? Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={handleClose}
                  className="accent-btn inline-block px-8 py-3 text-sm"
                >
                  Apply to Join
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
