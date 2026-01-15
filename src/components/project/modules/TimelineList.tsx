"use client";

import React from "react";

export function TimelineList({ modules }: { modules: any[] }) {
  if (!modules.length) return null;
  const sorted = [...modules].sort((a, b) =>
    (a.publishedAt || a.createdAt) > (b.publishedAt || b.createdAt) ? 1 : -1
  );
  return (
    <ol className="space-y-3 border-l border-[var(--ridge-outer)] pl-4">
      {sorted.map((m) => (
        <li key={m.id} className="relative folio-meta text-[var(--text-primary)]">
          <span className="absolute -left-[9px] top-1 h-2 w-2 rounded-full bg-[var(--text-tertiary)]" />
          <div className="font-medium">{m.title || "Update"}</div>
          {m.description && (
            <p className="folio-meta text-[var(--text-secondary)] mt-0.5">{m.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}


