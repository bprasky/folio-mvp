"use client";

import Link from "next/link";

interface TagRailProps {
  tags: any[];
}

export function TagRail({ tags }: TagRailProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="overflow-x-auto py-4">
      <div className="flex gap-3 min-w-max">
        {tags.map((tag) => (
          <Link
            key={tag.id}
            href={tag.productId ? `/products/${tag.productId}` : "#"}
            className="flex-shrink-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
          >
            {tag.productName}
          </Link>
        ))}
      </div>
    </div>
  );
}

