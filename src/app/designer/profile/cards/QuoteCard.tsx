'use client';

interface QuoteCardProps {
  quote: string;
  attribution?: string;
}

export default function QuoteCard({ quote, attribution }: QuoteCardProps) {
  return (
    <div className="quote-card rounded-xl p-4 flex flex-col justify-center">
      <div
        className="leading-none mb-1"
        style={{
          fontFamily: 'var(--font-headline)',
          fontSize: 'var(--type-h3)',
          color: 'var(--accent)',
        }}
      >
        &ldquo;
      </div>
      <p
        className="folio-quote"
        style={{ fontSize: 'var(--type-body)', margin: 0, lineHeight: 'var(--lh-body)' }}
      >
        {quote}
      </p>
      {attribution && (
        <div className="folio-meta mt-2" style={{ letterSpacing: 'var(--ls-wide)' }}>
          {attribution}
        </div>
      )}
      <style jsx>{`
        .quote-card {
          background: var(--surface-ground);
          border: 1px solid var(--border);
          min-height: 140px;
        }
      `}</style>
    </div>
  );
}
