"use client";

type Product = {
  id: string;
  name: string;
  imageUrl?: string | null;
  vendorName?: string | null;
  href?: string | null; // product page or external vendor link
};

export function ProductGrid({ items }: { items: Product[] }) {
  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900">
        Shop the Space
      </h3>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((p) => (
          <a
            key={p.id}
            href={p.href || "#"}
            className="group rounded-2xl ring-1 ring-black/5 overflow-hidden bg-neutral-50 hover:bg-neutral-100 transition"
          >
            <div className="relative">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="h-40 w-full flex items-center justify-center bg-neutral-100 text-[12px] text-neutral-500">
                  Image unavailable
                </div>
              )}
              <div className="absolute right-2 top-2 rounded-xl bg-white/70 backdrop-blur-md px-2 py-1 text-[11px] text-neutral-700 shadow-sm">
                {p.vendorName || "Vendor"}
              </div>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-[13px] text-neutral-800">
                {p.name}
              </p>
              <div className="mt-2 text-[12px] text-neutral-500">View →</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

