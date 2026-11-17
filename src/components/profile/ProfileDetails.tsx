import { externalIdentityUrl } from '@/lib/seo/public';

/** Native disclosure: useful public facts remain in the initial HTML when collapsed. */
export function ProfileDetails({ name, description, philosophy, location, specialties = [], services = [], serviceRegions = [], website, organization = false }: {
  name: string; description?: string | null; philosophy?: string | null; location?: string | null;
  specialties?: string[]; services?: string[]; serviceRegions?: string[]; website?: string | null; organization?: boolean;
}) {
  if (![description, philosophy, location, website].some(Boolean) && !specialties.length && !services.length && !serviceRegions.length) return null;
  const link = externalIdentityUrl(website);
  return <details className="max-w-6xl mx-auto px-6 py-4 text-folio-text-primary">
    <summary className="folio-ui cursor-pointer py-3 focus-visible:outline focus-visible:outline-2">{organization ? 'About the studio' : `About ${name}`}</summary>
    <div className="max-w-prose space-y-4 py-4 folio-body">
      {description && <p className="whitespace-pre-line">{description}</p>}
      {philosophy && philosophy !== description && <p className="whitespace-pre-line">{philosophy}</p>}
      <dl className="space-y-3 folio-meta">
        {location && <div><dt className="font-medium">Based in</dt><dd>{location}</dd></div>}
        {!!specialties.length && <div><dt className="font-medium">Specialties</dt><dd>{specialties.join(', ')}</dd></div>}
        {!!services.length && <div><dt className="font-medium">Services</dt><dd>{services.join(', ')}</dd></div>}
        {!!serviceRegions.length && <div><dt className="font-medium">Works in</dt><dd>{serviceRegions.join(', ')}</dd></div>}
      </dl>
      {link && <a className="inline-block underline underline-offset-4" href={link} target="_blank" rel="noopener noreferrer">Visit {name}’s website</a>}
    </div>
  </details>;
}
