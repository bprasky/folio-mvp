import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

export function ForDesignersHero() {
  return (
    <section className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="font-headline italic text-5xl md:text-6xl text-[var(--text-primary)] leading-tight">
          Your work is the product. Folio treats it that way.
        </h1>
        <p className="mt-6 text-lg text-[var(--text-secondary)] leading-relaxed">
          Folio is where interior designers publish completed projects as structured, documented records.
        </p>
      </div>
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
        <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
          The Process
        </p>
        <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <GlassCard
              key={i}
              variant="default"
              padding="md"
              rounded="xl"
              className="border border-stone-200/60"
            >
              <p className="text-sm font-medium text-[var(--accent)] mb-2">
                {i + 1}.
              </p>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                {step.title}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {step.description}
              </p>
            </GlassCard>
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
        <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
          Why Folio
        </p>
        <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-8">
          Start with what you&rsquo;ve earned.
        </h2>
        <div className="space-y-6 text-[var(--text-primary)] leading-relaxed">
          <p>
            Most platforms start with what they need from you. Reach without
            attribution. Leads without polish. Engagement without record.
          </p>
          <p>
            Folio starts with what you&rsquo;ve earned. A polished, permanent
            showcase of your work. Your story, told room by room. And full
            credit for every high-end material and product decision that made the
            project what it is.
          </p>
          <p>
            Your taste is documented. Your name is attached. Your work
            doesn&rsquo;t disappear.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FoundingCohort() {
  return (
    <section id="apply" className="py-24 px-6 bg-[#FAF9F6]">
      <div className="max-w-3xl mx-auto">
        <p className="uppercase tracking-widest text-sm text-[var(--text-secondary)] mb-3">
          Founding Designers
        </p>
        <h2 className="font-headline italic text-4xl md:text-5xl text-[var(--text-primary)] mb-8">
          We&rsquo;re building the founding cohort now.
        </h2>
        <div className="space-y-6 text-[var(--text-primary)] leading-relaxed mb-10">
          <p>
            Folio is invite-only during its founding phase. Founding designers
            receive permanent recognition on the platform and structural
            advantages that don&rsquo;t go away as the platform grows.
          </p>
          <p>If your work is ready, so are we.</p>
        </div>
        <Link href="/auth/signup" className="accent-btn inline-block px-6 py-3">
          Apply to Join
        </Link>
      </div>
    </section>
  );
}
