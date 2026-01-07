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
      <div className="rounded-[28px] bg-white/75 backdrop-blur-2xl ring-1 ring-black/5 px-6 py-5 md:px-8 md:py-6 space-y-4">
        <h2 className="text-[13px] font-semibold tracking-[0.16em] uppercase text-neutral-500">
          Materials
        </h2>
        <ul className="space-y-2">
          {items.map((item: any, idx: number) => (
            <li key={idx} className="text-[13px] text-neutral-800">
              <span className="font-medium">{item.name}</span>
              {item.finish && <span className="text-neutral-500"> • {item.finish}</span>}
              {item.note && <span className="text-neutral-500 text-[12px]"> • {item.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

