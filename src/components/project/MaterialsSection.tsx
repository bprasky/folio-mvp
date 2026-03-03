"use client";

type MaterialsSectionProps = {
  post: any;
};

export function MaterialsSection({ post }: MaterialsSectionProps) {
  const materialsLedger = post?.expandedBlocks?.materialsLedger;
  const items = materialsLedger?.items && Array.isArray(materialsLedger.items) 
    ? materialsLedger.items 
    : [];

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-4xl px-3 md:px-0">
      <div className="px-6 py-5 md:px-8 md:py-6 space-y-4">
        <h2 className="folio-ui tracking-[0.16em] uppercase text-[var(--text-secondary)]">
          Materials
        </h2>
        <ul className="space-y-2">
          {items.map((item: any, idx: number) => (
            <li key={idx} className="folio-meta text-[var(--text-primary)]">
              <span className="font-medium">{item.name}</span>
              {item.finish && <span className="text-[var(--text-secondary)]"> • {item.finish}</span>}
              {item.note && <span className="text-[var(--text-secondary)] folio-meta"> • {item.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

