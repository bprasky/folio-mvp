"use client";

import React from "react";

export function TimelineList({ modules }: { modules: any[] }) {
  if (!modules.length) return null;
  const sorted = [...modules].sort((a, b) =>
    (a.publishedAt || a.createdAt) > (b.publishedAt || b.createdAt) ? 1 : -1
  );
  return (
    <ol className="space-y-3 border-l border-neutral-200 pl-4">
      {sorted.map((m) => (
        <li key={m.id} className="relative text-[13px] text-neutral-700">
          <span className="absolute -left-[9px] top-1 h-2 w-2 rounded-full bg-neutral-400" />
          <div className="font-medium">{m.title || "Update"}</div>
          {m.description && (
            <p className="text-[12px] text-neutral-600 mt-0.5">{m.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}


