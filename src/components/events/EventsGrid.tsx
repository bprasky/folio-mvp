import Image from '@/components/FolioImage';
import Link from 'next/link';

export default function EventsGrid({ items }: { items: any[] }) {
  if (!items?.length) return (
    <div className="rounded-lg border border-folio-border-subtle bg-surface-canvas p-6 text-folio-text-secondary">
      No events yet—check back soon.
    </div>
  );
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((e) => (
        <Link key={e.id} href={`/events/${e.id}`} className="group rounded-xl overflow-hidden border border-folio-border-subtle bg-surface-canvas hover:shadow-md transition">
          <div className="relative aspect-[4/3] bg-surface-ground">
            {e.imageUrl ? (
              <Image src={e.imageUrl} alt={e.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            ) : null}
          </div>
          <div className="p-4">
            <div className="text-xs text-folio-text-secondary mb-1">{e.location ?? 'Location TBA'}</div>
            <h3 className="font-medium leading-snug line-clamp-2 text-folio-text-primary">{e.title}</h3>
          </div>
        </Link>
      ))}
    </section>
  );
}




















