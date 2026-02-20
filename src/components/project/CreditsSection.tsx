"use client";

type CreditsSectionProps = {
  post: any;
};

export function CreditsSection({ post }: CreditsSectionProps) {
  // Check both top-level credits and expandedBlocks.credits for compatibility
  const topCredits = post?.credits && Array.isArray(post.credits) ? post.credits : [];
  const blockCredits = post?.expandedBlocks?.credits && Array.isArray(post.expandedBlocks.credits) ? post.expandedBlocks.credits : [];
  const credits = topCredits.length > 0 ? topCredits : blockCredits;
  const author = post?.project?.designer;

  if (credits.length === 0 && !author?.name) return null;

  return (
    <section className="mx-auto max-w-4xl px-3 md:px-0">
      <div className="ridge-card px-6 py-5 md:px-8 md:py-6 space-y-4">
        {credits.length > 0 && (
          <div className="flex flex-wrap gap-4 folio-meta text-[var(--text-secondary)]">
            {credits.map((credit: any, idx: number) => (
              <div key={idx}>
                <span className="font-medium">{credit.role}:</span>{" "}
                {credit.url ? (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-primary)] hover:underline"
                  >
                    {credit.name}
                  </a>
                ) : (
                  <span>{credit.name}</span>
                )}
              </div>
            ))}
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

