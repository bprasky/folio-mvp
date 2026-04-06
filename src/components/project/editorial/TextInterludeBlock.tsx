'use client';


interface TextInterludeBlockProps {
  roomName?: string | null;
  text: string;
}

/**
 * TextInterludeBlock - Editorial text break
 * 
 * Provides breathing room and narrative context.
 * Used for room blurbs, project descriptions, or editorial commentary.
 */
export function TextInterludeBlock({ roomName, text }: TextInterludeBlockProps) {
  return (
    <section className="w-full py-10 md:py-14 col-span-12 md:col-span-10 md:col-start-2 lg:col-span-8 lg:col-start-3">
      {/* No border - whitespace + alignment only */}
      <div className="p-8 md:p-12">
        <div className="space-y-4">
          {/* Room Label */}
          {roomName && (
            <div className="folio-ui uppercase tracking-wider text-folio-text-secondary mb-2">
              {roomName}
            </div>
          )}

          {/* Editorial Text */}
          <div className="prose prose-neutral max-w-none">
            <p className="text-lg md:text-xl leading-relaxed text-folio-text-primary font-light">
              {text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

