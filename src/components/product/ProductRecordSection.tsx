/**
 * Product Record surface (spec 22_PRODUCT_RECORD, Phase A).
 *
 * Server component. It renders what the serializer handed it and makes no
 * visibility decisions of its own: `getProductRecord` has already dropped
 * testimony this audience may not read, and every image URL has already been
 * through `resolveProductImage`. If this file ever needs to ask who is looking,
 * the gate has been put in the wrong place.
 *
 * The coverage sentence is unconditional. A record that hides its own ratio when
 * the ratio is unflattering is the failure mode disclosure exists to prevent.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ProductRecordView } from '@/server/queries/getProductRecord';

function TierBadge({ tier }: { tier: ProductRecordView['tier'] }) {
  const label = tier === 'ARTICLE' ? 'Record · Article' : tier === 'RECORD' ? 'Record' : 'Listing';
  return (
    <span
      className="folio-eyebrow inline-block px-2 py-1 rounded-sm"
      style={{ color: 'var(--folio-gold)', border: '1px solid var(--folio-gold)' }}
    >
      {label}
    </span>
  );
}

function Installations({ items }: { items: ProductRecordView['installations'] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="folio-eyebrow mb-4">Specified in</h3>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-4 list-none p-0 m-0">
        {items.map((install) => {
          const caption = (
            <>
              <span className="folio-ui block">{install.projectTitle || 'Untitled project'}</span>
              <span className="folio-meta block">
                {[install.designerName, install.room].filter(Boolean).join(' · ')}
              </span>
            </>
          );

          return (
            <li key={install.imageId}>
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded-sm bg-surface-ground">
                <Image
                  src={install.imageUrl}
                  alt={`${install.projectTitle || 'Project'} — in situ`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="mt-2">
                {install.postSlug ? (
                  <Link href={`/posts/${install.postSlug}`} className="no-underline">
                    {caption}
                  </Link>
                ) : (
                  caption
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Testimony({ record }: { record: ProductRecordView }) {
  // Three distinguishable states, and they must stay distinguishable. "Nobody
  // has said anything" and "people have said things you may not read" are
  // different facts, and collapsing them into one empty section both lies to the
  // reader and throws away the signup argument.
  if (record.testimony.length === 0 && record.testimonyLocked) {
    return (
      <div
        className="mt-8 p-6 rounded-sm"
        style={{ backgroundColor: 'var(--surface-ground)' }}
      >
        <h3 className="folio-eyebrow mb-2">Testimony</h3>
        <p className="folio-body m-0">
          {record.lockedTestimonyCount === 1
            ? '1 designer has written about this product on Folio.'
            : `${record.lockedTestimonyCount} designers have written about this product on Folio.`}{' '}
          Specification reasoning is readable by Folio designers, and by this
          product&rsquo;s vendor once the product is claimed.
        </p>
      </div>
    );
  }

  if (record.testimony.length === 0) {
    // No synthetic, sample, or AI-drafted quotes here — not as illustration, not
    // greyed out, not labelled as an example. The empty slot is the pitch.
    return (
      <div className="mt-8">
        <h3 className="folio-eyebrow mb-2">Testimony</h3>
        <p className="folio-body m-0">
          No designer has written about this product yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="folio-eyebrow mb-4">Testimony</h3>
      <ul className="list-none p-0 m-0 space-y-6">
        {record.testimony.map((t) => (
          <li
            key={t.id}
            className="pl-4"
            style={{ borderLeft: '1px solid var(--folio-gold)' }}
          >
            <p className="folio-quote m-0">{t.answer}</p>
            <p className="folio-meta mt-2 mb-0">
              {[
                t.designerName,
                t.designerCompany,
                t.projectTitle,
                t.testimonyClass === 'COMMISSIONED' ? 'Commissioned' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductRecordSection({ record }: { record: ProductRecordView }) {
  // A listing with no specification events has nothing to say. Absent, not
  // greyed out with an explanation — a block whose data dependency is unmet does
  // not appear (spec 21 §4).
  if (record.tier === 'LISTING' && record.installations.length === 0) return null;

  return (
    <section
      className="max-w-5xl mx-auto px-6 py-12"
      aria-labelledby="product-record-heading"
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 id="product-record-heading" className="folio-h2 m-0">
          The Record
        </h2>
        <TierBadge tier={record.tier} />
      </div>

      <p className="folio-body mt-3 mb-0">{record.coverageDisclosure}</p>

      {record.firstSpecifier?.name && (
        <p className="folio-meta mt-1 mb-0">
          First specified by {record.firstSpecifier.name}.
        </p>
      )}

      <Installations items={record.installations} />
      <Testimony record={record} />
    </section>
  );
}
