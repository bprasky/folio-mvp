"use client";

// StoryCredits — Final credits section at the bottom of the story.

interface StoryCreditProps {
  credits: Array<{ role: string; name: string; url?: string }>;
}

export function StoryCredits({ credits }: StoryCreditProps) {
  if (!credits.length) return null;

  return (
    <section
      className="px-4 sm:px-8 pt-8 pb-12 border-t"
      style={{ borderColor: "rgba(87, 75, 67, 0.06)" }}
    >
      <h4
        className="mb-4 uppercase tracking-[1.5px]" /* folio-design-system: off-scale */
        style={{
          fontSize: 'var(--type-fine)',
          fontWeight: 'var(--w-h1)',
          color: "var(--folio-text-secondary)"
        }}
      >
        Credits
      </h4>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {credits.map((credit, i) => (
          <div
            key={i}
            style={{
              fontSize: 'var(--type-eyebrow)',
              color: "var(--folio-text-secondary)"
            }}
          >
            <span className="uppercase tracking-[var(--ls-wide)]">{credit.role}</span>
            {": "}
            {credit.url ? (
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "var(--folio-text-secondary)" }}
              >
                {credit.name}
              </a>
            ) : (
              <span style={{ color: "var(--folio-text-secondary)" }}>{credit.name}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
