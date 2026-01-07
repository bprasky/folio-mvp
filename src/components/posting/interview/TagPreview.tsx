"use client";

interface TagPreviewProps {
  materials: Array<{
    name: string;
    vendor?: string;
    thumb?: string;
  }>;
}

export function TagPreview({ materials }: TagPreviewProps) {
  if (!materials?.length) return null;

  return (
    <aside className="w-full md:w-72 shrink-0 md:pl-4">
      <div className="rounded-xl border p-3 bg-white">
        <div className="font-semibold mb-2 text-gray-900">Tagged Materials</div>
        <ul className="space-y-2">
          {materials.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              {m.thumb ? (
                <img
                  src={m.thumb}
                  alt={m.name}
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded" />
              )}
              <div className="text-sm flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{m.name}</div>
                {m.vendor && (
                  <div className="text-xs text-gray-500 truncate">{m.vendor}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          These will be woven into the article automatically.
        </p>
      </div>
    </aside>
  );
}


