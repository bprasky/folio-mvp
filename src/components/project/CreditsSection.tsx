"use client";

type CreditsSectionProps = {
  post: any;
};

export function CreditsSection({ post }: CreditsSectionProps) {
  const credits = post?.credits && Array.isArray(post.credits) ? post.credits : [];
  const author = post?.project?.designer;

  if (credits.length === 0 && !author?.name) return null;

  return (
    <section className="mx-auto max-w-4xl px-3 md:px-0">
      <div className="rounded-[28px] bg-white/75 backdrop-blur-2xl ring-1 ring-black/5 px-6 py-5 md:px-8 md:py-6 space-y-4">
        {credits.length > 0 && (
          <div className="flex flex-wrap gap-4 text-[12px] text-neutral-600">
            {credits.map((credit: any, idx: number) => (
              <div key={idx}>
                <span className="font-medium">{credit.role}:</span>{" "}
                {credit.url ? (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:underline"
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
          <div className="text-[12px] text-neutral-500 pt-2 border-t border-neutral-200">
            By {author.name}
          </div>
        )}
      </div>
    </section>
  );
}

