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
          fontSize: '28px',
          color: 'var(--accent)',
        }}
      >
        &ldquo;
      </div>
      <p
        className="folio-quote"
        style={{ fontSize: '15px', margin: 0, lineHeight: 1.5 }}
      >
        {quote}
      </p>
      {attribution && (
        <div className="folio-meta mt-2" style={{ letterSpacing: '0.05em' }}>
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
