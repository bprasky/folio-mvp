"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const SESSION_KEY = "folio-landing-seen";

const whatYouGet = [
  "Editorial Publishing",
  "Sourcebook & Actions",
  "Project Procurement",
  "Unified Communications",
  "Directory & Discovery",
];

const steps = [
  {
    title: "Publish your work",
    description:
      "Upload your photography, walk through a brief interview, and Folio generates an editorial-quality project post \u2014 in your voice, under your name.",
  },
  {
    title: "Run your projects",
    description:
      "Every product you tag builds your Sourcebook. Request quotes, track lead times, and manage procurement from one project board.",
  },
  {
    title: "Own every conversation",
    description:
      "Vendor emails, rep texts, contractor updates \u2014 one searchable inbox linked to your projects and products. Nothing gets lost.",
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
                      One place for your projects, your products, and every conversation in between.
                    </h2>
                    <p className="mt-5 text-center text-base md:text-lg text-folio-text-secondary leading-relaxed max-w-xl mx-auto">
                      Folio is where interior designers publish work, manage
                      procurement, and keep every vendor communication organized
                      &mdash; from first quote to final install.
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
                      One platform for the whole studio.
                    </h3>
                    <div className="space-y-2">
                      {whatYouGet.map((label, i) => (
                        <p
                          key={i}
                          className="text-sm text-folio-text-primary leading-relaxed"
                        >
                          <span style={{ color: "#c9a96e" }}>&#10022;</span>
                          {" "}{label}
                        </p>
                      ))}
                    </div>
                    <Link
                      href="/for-designers"
                      onClick={handleClose}
                      className="inline-block mt-4 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      Explore all features &rarr;
                    </Link>
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
