"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface EditorialPreviewProps {
  title: string;
  excerpt: string;
  heroImage?: string;
  isGenerating?: boolean;
}

/**
 * EditorialPreview
 *
 * Shows a live preview of the editorial being generated.
 * Displayed after 3-4 responses to show value and maintain motivation.
 *
 * Layout:
 * - Card container: bg-white rounded-xl shadow-lg overflow-hidden
 * - Hero image: aspect-[16/9] object-cover (if provided)
 * - Content padding: p-6
 * - Title: text-xl font-serif
 * - Excerpt: text-[var(--text-secondary)] line-clamp-4
 * - Label: "Preview" in small caps, bottom right
 *
 * Shimmer effect (isGenerating: true):
 * - Animate gradient across text areas
 * - Placeholder blocks for title and excerpt
 */
export function EditorialPreview({
  title,
  excerpt,
  heroImage,
  isGenerating = false,
}: EditorialPreviewProps) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-[var(--text-secondary)]">
        Your story is taking shape
      </p>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-md mx-auto">
        {/* Hero image */}
        {heroImage && (
          <div className="relative aspect-[16/9]">
            <Image
              src={heroImage}
              alt="Project hero"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-3">
          {isGenerating ? (
            // Shimmer placeholders
            <>
              <div className="h-6 bg-[var(--bg-elevated)] rounded animate-pulse w-3/4" />
              <div className="space-y-2">
                <div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse" />
                <div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse" />
                <div className="h-4 bg-[var(--bg-elevated)] rounded animate-pulse w-2/3" />
              </div>
            </>
          ) : (
            // Actual content
            <>
              <h3 className="text-xl font-serif text-[var(--text-primary)]">{title}</h3>
              <p className="text-[var(--text-secondary)] line-clamp-4 text-sm leading-relaxed">
                {excerpt}
              </p>
            </>
          )}

          {/* Preview label */}
          <div className="flex justify-end pt-2">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
              Preview
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
