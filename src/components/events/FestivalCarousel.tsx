'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function FestivalCarousel({ festivals }: { festivals: any[] }) {
  if (!festivals?.length) return null;
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Festivals</h2>
        {/* optional: <Link href="/festivals" className="text-sm underline">All festivals</Link> */}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {festivals.map((f) => (
          <div key={f.id} className="min-w-[320px] shrink-0 rounded-xl border bg-white hover:shadow transition">
            <div className="relative h-40 w-full bg-neutral-100">
              {f.imageUrl ? (
                <Image src={f.imageUrl} alt={f.title} fill className="object-cover" />
              ) : null}
            </div>
            <div className="p-4">
              <div className="text-xs text-neutral-500 mb-1">
                {f.startDate ? new Date(f.startDate).toLocaleDateString() : ''}{f.endDate ? ` – ${new Date(f.endDate).toLocaleDateString()}` : ''}
              </div>
              <h3 className="font-medium line-clamp-2 mb-3">{f.title}</h3>
              <div className="flex gap-2">
                <Link
                  href={`/festivals/${f.id}`}
                  className="px-3 py-1.5 text-sm rounded-md bg-black text-white"
                >
                  View events
                </Link>
                <button className="px-3 py-1.5 text-sm rounded-md border">
                  RSVP
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}



