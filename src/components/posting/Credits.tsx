"use client";

/**
 * Credits — Grid-based display of multi-party credits.
 * Used in the PostExpanded (legacy expanded view) component.
 *
 * Supports userId-based Folio profile links and external URLs.
 *
 * --- Future: Super Articles (see docs/15_SUPER_ARTICLES.md) ---
 * - userId will link to contributor's perspective tab in Super-Articles.
 */

interface CreditsProps {
  credits: any;
}

export function Credits({ credits }: CreditsProps) {
  if (!credits) return null;

  const creditsArray = Array.isArray(credits) ? credits : [];

  if (creditsArray.length === 0) return null;

  return (
    <div className="border-t border-[var(--ridge-outer)] pt-6">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-4">
        Credits
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {creditsArray.map((credit: any, idx: number) => {
          const href = credit.userId
            ? `/designer/${credit.userId}`
            : credit.url || undefined;
          return (
            <div key={idx}>
              <span className="font-medium text-[var(--text-primary)]">{credit.role}</span>
              {href ? (
                <a
                  href={href}
                  target={credit.userId ? undefined : "_blank"}
                  rel={credit.userId ? undefined : "noopener noreferrer"}
                  className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                >
                  {credit.name}
                </a>
              ) : (
                <span className="ml-2 text-[var(--text-secondary)]">{credit.name}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
