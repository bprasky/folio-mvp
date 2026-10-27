'use client';

import { useState } from 'react';
import Image from '@/components/FolioImage';

interface VisitProductCardProps {
  visitId: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  brand: string | null;
  price: number | null;
  url: string | null;
  autoShared: boolean;
  savedByRecipient: boolean;
  savedToProjectId: string | null;
  projects?: Array<{ id: string; title: string }>;
}

export default function VisitProductCard({
  visitId,
  productId,
  name,
  imageUrl,
  category,
  brand,
  price,
  url,
  savedByRecipient: initialSaved,
  projects = [],
}: VisitProductCardProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  async function handleSave(projectId?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/products/${productId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        setSaved(true);
        setShowProjects(false);
      }
    } catch (err) {
      console.error('[VisitProductCard] Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Product Image */}
      <div className="relative aspect-square bg-stone-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-stone-400">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3">
        {brand && (
          <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">{brand}</p>
        )}
        <h3 className="text-sm font-medium text-stone-900 line-clamp-2">{name}</h3>
        {category && (
          <p className="text-xs text-stone-500 mt-1">{category}</p>
        )}
        {price != null && (
          <p className="text-sm font-medium text-stone-700 mt-1">
            ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 relative">
          {saved ? (
            <div className="flex items-center gap-1 text-green-600 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </div>
          ) : (
            <>
              <button
                onClick={() => projects.length > 0 ? setShowProjects(!showProjects) : handleSave()}
                disabled={saving}
                className="w-full text-xs bg-stone-900 text-white py-1.5 px-3 rounded hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save to project'}
              </button>

              {showProjects && projects.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleSave()}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 border-b border-stone-100"
                  >
                    Save without project
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSave(p.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50"
                    >
                      {p.title || 'Untitled Project'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-stone-500 hover:text-stone-700 mt-1.5"
            >
              View product page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
