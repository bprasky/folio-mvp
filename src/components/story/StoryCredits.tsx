"use client";

// StoryCredits — Final credits section at the bottom of the story.

interface StoryCreditProps {
  credits: Array<{ role: string; name: string; url?: string }>;
}

export function StoryCredits({ credits }: StoryCreditProps) {
  if (!credits.length) return null;

  return (
    <section
      className="pt-8 pb-12 border-t"
      style={{ borderColor: "rgba(87, 75, 67, 0.06)" }}
    >
      <h4
        className="mb-4 uppercase tracking-[1.5px]"
        style={{
          fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
          fontSize: "10px",
          fontWeight: 500,
          color: "rgba(87, 75, 67, 0.3)",
        }}
      >
        Credits
      </h4>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {credits.map((credit, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-body, 'Instrument Sans', sans-serif)",
              fontSize: "11px",
              color: "rgba(87, 75, 67, 0.55)",
            }}
          >
            <span className="uppercase tracking-[1px]">{credit.role}</span>
            {": "}
            {credit.url ? (
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: "rgba(87, 75, 67, 0.7)" }}
              >
                {credit.name}
              </a>
            ) : (
              <span style={{ color: "rgba(87, 75, 67, 0.7)" }}>{credit.name}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
