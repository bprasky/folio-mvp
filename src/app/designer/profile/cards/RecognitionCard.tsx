interface RecognitionCardProps {
  item: {
    id: string;
    title: string;
    source: string;
    date: string | Date;
    excerpt?: string | null;
  };
}

export default function RecognitionCard({ item }: RecognitionCardProps) {
  const dateStr =
    typeof item.date === 'string'
      ? item.date
      : item.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

  return (
    <div className="recognition-card rounded-xl p-4 flex flex-col justify-between">
      <div>
        <span className="recognition-label">Recognition</span>
        <h4
          className="mt-1.5 mb-0 text-white leading-tight"
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
          {item.title}
        </h4>
      </div>
      {item.excerpt && (
        <p className="recognition-excerpt mt-2 mb-0">&ldquo;{item.excerpt}&rdquo;</p>
      )}
      <div className="text-[10px] text-white/40 mt-2">
        {item.source} &middot; {dateStr}
      </div>
      <style jsx>{`
        .recognition-card {
          background: linear-gradient(135deg, var(--text-primary) 0%, #3D3630 100%);
          min-height: 140px;
          cursor: pointer;
        }
        .recognition-label {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .recognition-excerpt {
          font-family: var(--font-headline);
          font-size: 12px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
