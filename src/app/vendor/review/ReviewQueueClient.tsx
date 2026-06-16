'use client';

import { useEffect, useState } from 'react';
import { FaCheck, FaTimes, FaExternalLinkAlt, FaTag, FaUsers } from 'react-icons/fa';

interface QueueItem {
  candidateId: string;
  matchType: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    imageUrl: string | null;
    url: string | null;
    description: string | null;
  };
  usage: { tagCount: number; designerCount: number };
}

export default function ReviewQueueClient({ vendorName }: { vendorName: string }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/vendor/review-queue');
      if (res.ok) {
        const d = await res.json();
        setItems(d.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (candidateId: string, action: 'confirm' | 'reject') => {
    setBusyId(candidateId);
    try {
      const res = await fetch('/api/vendor/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, action }),
      });
      if (res.ok) {
        // Drop the resolved item from the list.
        setItems((prev) => prev.filter((i) => i.candidateId !== candidateId));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-folio-text-primary">Review products</h1>
        <p className="mt-1 text-sm text-folio-text-secondary">
          Designers tagged these products as <span className="font-medium">{vendorName}</span>.
          Confirm the ones that are yours to add them to your catalog, or dismiss the ones that
          aren&apos;t. Confirming never changes who tagged a product.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-folio-text-tertiary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-folio-text-tertiary">Nothing to review right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.candidateId}
              className="flex gap-4 rounded-xl border border-folio-border-subtle bg-surface-card p-4"
            >
              {item.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="h-20 w-20 flex-shrink-0 rounded-lg object-cover bg-surface-ground"
                />
              ) : (
                <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-surface-ground" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-folio-text-primary">
                      {item.product.name}
                    </p>
                    <p className="truncate text-xs text-folio-text-secondary">
                      {[item.product.brand, item.product.category]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                      {item.product.price != null && ` · $${item.product.price}`}
                    </p>
                  </div>
                  {item.product.url && (
                    <a
                      href={item.product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-folio-text-tertiary hover:text-[var(--accent)]"
                      title="Open product page"
                    >
                      <FaExternalLinkAlt className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-folio-text-tertiary">
                  <span className="flex items-center gap-1">
                    <FaTag className="h-3 w-3" /> {item.usage.tagCount} tag
                    {item.usage.tagCount === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1">
                    <FaUsers className="h-3 w-3" /> {item.usage.designerCount} designer
                    {item.usage.designerCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => act(item.candidateId, 'confirm')}
                    disabled={busyId === item.candidateId}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <FaCheck className="h-3 w-3" /> This is ours
                  </button>
                  <button
                    onClick={() => act(item.candidateId, 'reject')}
                    disabled={busyId === item.candidateId}
                    className="flex items-center gap-1.5 rounded-lg border border-folio-border-subtle px-3 py-1.5 text-xs font-medium text-folio-text-secondary hover:bg-surface-ground disabled:opacity-50"
                  >
                    <FaTimes className="h-3 w-3" /> Not ours
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
