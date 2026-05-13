'use client';

import { useState } from 'react';

interface WebsiteImportCardProps {
  defaultUrl?: string | null;
  onImported: () => void;
  onSkip: () => void;
}

export default function WebsiteImportCard({ defaultUrl, onImported, onSkip }: WebsiteImportCardProps) {
  const [url, setUrl] = useState(defaultUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape() {
    const trimmed = url.trim();
    if (!trimmed) return;

    // Ensure URL has protocol
    const fullUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/designer/bio/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to import website');
      }

      onImported();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bio-card">
      <div className="bio-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
      <h4 className="bio-card-title">Import from your website</h4>
      <p className="bio-card-desc">
        We&rsquo;ll pull your existing bio and use it as a starting point for deeper questions.
      </p>

      <div className="bio-url-row">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourfirm.com"
          className="bio-url-input"
          onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
          disabled={loading}
        />
        <button
          onClick={handleScrape}
          disabled={loading || !url.trim()}
          className="accent-btn pill-btn bio-url-btn"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>

      {error && <p className="bio-card-error">{error}</p>}

      <button onClick={onSkip} className="bio-skip-link" disabled={loading}>
        Skip — I&rsquo;ll start from scratch
      </button>

      <style jsx>{`
        .bio-card {
          padding: 32px;
          border-radius: 12px;
          background: var(--surface-canvas);
          border: 1px solid var(--border);
          text-align: center;
        }
        .bio-card-icon {
          color: var(--text-tertiary);
          margin-bottom: 16px;
        }
        .bio-card-title {
          font-family: var(--font-headline);
          font-size: 18px;
          font-weight: 500;
          color: var(--text-primary);
          margin: 0 0 8px;
        }
        .bio-card-desc {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .bio-url-row {
          display: flex;
          gap: 8px;
          max-width: 400px;
          margin: 0 auto 16px;
        }
        .bio-url-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface-ground);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
        }
        .bio-url-input:focus {
          border-color: var(--accent);
        }
        .bio-url-btn {
          padding: 10px 20px;
          font-size: 13px;
          white-space: nowrap;
        }
        .bio-card-error {
          color: #e74c3c;
          font-size: 13px;
          margin: 0 0 12px;
        }
        .bio-skip-link {
          background: none;
          border: none;
          color: var(--text-tertiary);
          font-family: var(--font-body);
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .bio-skip-link:hover {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
