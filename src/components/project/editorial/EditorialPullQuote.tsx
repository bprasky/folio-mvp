'use client';

interface EditorialPullQuoteProps {
  text: string;
  attribution?: string | null;
}

/**
 * EditorialPullQuote — Magazine-style pull quote
 *
 * Breaks the paragraph flow with typographic emphasis.
 * Cormorant Garamond italic for the quote, Instrument Sans for attribution.
 * No card, no background — just typography and whitespace.
 */
export function EditorialPullQuote({ text, attribution }: EditorialPullQuoteProps) {
  return (
    <section className="w-full py-14 md:py-20 col-span-12">
      <div className="max-w-3xl mx-auto px-6 md:px-8 text-center">
        {/* Thin centered rule */}
        <hr className="border-t border-folio-border-subtle mb-10 max-w-[120px] mx-auto" />

        {/* Quote text — Cormorant Garamond italic */}
        <blockquote className="font-[var(--font-headline)] text-[var(--type-h4)] md:text-[var(--type-h3)] lg:text-[var(--type-h3)] font-normal italic leading-relaxed text-folio-text-primary">
          {text}
        </blockquote>

        {/* Attribution — Instrument Sans, muted */}
        {attribution && (
          <p className="mt-6 font-[var(--font-body)] text-sm tracking-wide uppercase text-folio-text-tertiary">
            — {attribution}
          </p>
        )}
      </div>
    </section>
  );
}
