"use client";

/**
 * CreditsSection — Renders multi-party credits on the published article page.
 *
 * Supports the full CreditEntry schema: role, name, userId, url.
 * When a userId is present, the name links to the Folio profile.
 * When a url is present (but no userId), the name links externally.
 *
 * --- Future: Super Articles (see docs/15_SUPER_ARTICLES.md) ---
 * - Each credited party with a userId may eventually have a contributed perspective
 *   tab, turning the article into a multi-perspective Super-Article.
 * - Credits with contributionStatus === "contributed" could show a badge or icon.
 */

import { parseCredits } from "@/lib/posting/creditsSchema";
import type { CreditEntry } from "@/lib/posting/creditsSchema";

type CreditsSectionProps = {
  post: any;
};

export function CreditsSection({ post }: CreditsSectionProps) {
  const credits = parseCredits(post?.credits);
  const author = post?.project?.designer;

  if (credits.length === 0 && !author?.name) return null;

  return (
    <section className="mx-auto max-w-4xl px-3 md:px-0">
      <div className="ridge-card px-6 py-5 md:px-8 md:py-6 space-y-4">
        {credits.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 folio-meta text-[var(--text-secondary)]">
            {credits.map((credit: CreditEntry, idx: number) => {
              const href = credit.userId
                ? `/designer/${credit.userId}`
                : credit.url || undefined;
              return (
                <div key={idx}>
                  <span className="font-medium">{credit.role}:</span>{" "}
                  {href ? (
                    <a
                      href={href}
                      target={credit.userId ? undefined : "_blank"}
                      rel={credit.userId ? undefined : "noopener noreferrer"}
                      className="text-[var(--text-primary)] hover:underline"
                    >
                      {credit.name}
                    </a>
                  ) : (
                    <span>{credit.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {author?.name && (
          <div className="folio-meta text-[var(--text-secondary)] pt-2 border-t border-[var(--ridge-outer)]">
            By {author.name}
          </div>
        )}
      </div>
    </section>
  );
}
