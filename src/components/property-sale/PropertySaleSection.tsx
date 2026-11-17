import type { PublicPropertySale } from '@/lib/property-sale/schema';
import styles from './PropertySale.module.css';

export function PropertySaleSection({ sale }: { sale?: PublicPropertySale | null }) {
  if (!sale) return null;
  const listing = sale.listing;
  const price = listing?.askingPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: listing.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(listing.askingPrice)) : null;
  const date = listing ? new Date(listing.confirmedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
  return <section aria-label="Property information" className={styles.section}>
    {(listing || sale.address) && <div className={styles.listing}>
      <div>
        <p className={styles.eyebrow}>{listing ? listing.fresh ? 'Currently for sale' : 'Property listing' : 'About the property'}</p>
        <div className={styles.priceAndListing}><div><h2 className={styles.headline}>{sale.address || (price ? `${price} ${listing?.currency}` : 'Explore the property')}</h2>
        {sale.address && price && <p className={styles.price}>Asking {price}<span>{listing?.currency}</span></p>}</div>
        {listing?.listingUrl && <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" className={styles.primary}>View listing <span aria-hidden>↗</span></a>}</div>
        {listing && <p className={styles.fine}>Confirmed by the project team · {date}{!listing.fresh ? '. Visit the listing for current availability and price.' : ''}</p>}
      </div>
      {listing && (listing.agentName || listing.brokerage || listing.contactUrl) && <div>
        {(listing.agentName || listing.brokerage) && <p className={styles.agent}>{[listing.agentName, listing.brokerage].filter(Boolean).join(' · ')}</p>}
        <div className={styles.actions}>
          {listing.contactUrl && <a href={listing.contactUrl} target="_blank" rel="noopener noreferrer" className={styles.secondary}>Contact agent <span aria-hidden>↗</span></a>}
        </div>
      </div>}
    </div>}
    {sale.pressLinks.length > 0 && <div className={styles.press}><h2 className={styles.eyebrow}>Press & project links</h2><ul>{sale.pressLinks.map((link, index) => <li key={`${index}-${link.url}`}><a href={link.url} target="_blank" rel="noopener noreferrer" className={styles.secondary}>{link.title} <span aria-hidden>↗</span></a></li>)}</ul></div>}
  </section>;
}
