"use client";

import React from "react";

export function BoardsGrid({ modules }: { modules: any[] }) {
  if (!modules.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modules.map((m) => (
        <a
          key={m.id}
          href={m.media?.[0]?.boardUrl || "#"}
          className="ridge-card p-4 flex flex-col gap-2"
        >
          <div className="folio-meta font-medium text-[var(--text-primary)]">
            {m.title || "Design Board"}
          </div>
          <p className="folio-meta text-[var(--text-secondary)] line-clamp-3">
            {m.description || "Open the selections and moodboard for this project."}
          </p>
        </a>
      ))}
    </div>
  );
}


