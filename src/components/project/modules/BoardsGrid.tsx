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
          className="rounded-2xl ring-1 ring-black/5 bg-neutral-50 p-4 flex flex-col gap-2"
        >
          <div className="text-[13px] font-medium text-neutral-900">
            {m.title || "Design Board"}
          </div>
          <p className="text-[12px] text-neutral-600 line-clamp-3">
            {m.description || "Open the selections and moodboard for this project."}
          </p>
        </a>
      ))}
    </div>
  );
}


