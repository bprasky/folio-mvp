interface CollabCardProps {
  vendor: string;
  note: string;
}

export default function CollabCard({ vendor, note }: CollabCardProps) {
  return (
    <div className="collab-card rounded-xl p-4">
      <span className="collab-label">Collaboration</span>
      <h4
        className="text-sm font-semibold mt-1.5 mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {vendor}
      </h4>
      <p className="text-xs m-0 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {note}
      </p>
      <style jsx>{`
        .collab-card {
          background: var(--surface-ground);
          border: 1px solid var(--border);
          min-height: 100px;
          cursor: pointer;
        }
        .collab-label {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7A5C7A;
        }
      `}</style>
    </div>
  );
}
