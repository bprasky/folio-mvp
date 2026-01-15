import Image from 'next/image';
import Link from 'next/link';

export default function EventsGrid({ items }: { items: any[] }) {
  if (!items?.length) return (
    <div className="rounded-lg border border-[var(--ridge-outer)] bg-[var(--bg-base)] p-6 text-[var(--text-secondary)]">
      No events yet—check back soon.
    </div>
  );
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((e) => (
        <Link key={e.id} href={`/events/${e.id}`} className="group rounded-xl overflow-hidden border border-[var(--ridge-outer)] bg-[var(--bg-base)] hover:shadow-md transition">
          <div className="relative aspect-[4/3] bg-[var(--bg-elevated)]">
            {e.imageUrl ? (
              <Image src={e.imageUrl} alt={e.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            ) : null}
          </div>
          <div className="p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">{e.location ?? 'Location TBA'}</div>
            <h3 className="font-medium leading-snug line-clamp-2 text-[var(--text-primary)]">{e.title}</h3>
          </div>
        </Link>
      ))}
    </section>
  );
}




















