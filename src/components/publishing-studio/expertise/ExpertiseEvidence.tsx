import type { ExpertiseEvidence as Evidence } from '@/lib/publishing-studio/expertise/types';

export function ExpertiseEvidence({ evidence, compact = false }: { evidence: Evidence[]; compact?: boolean }) {
  return <div className={compact ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>{evidence.map(item => <figure key={item.id} className="min-w-0">
    {item.imageUrl && <img src={item.imageUrl} alt={item.alt || `${item.roomName || 'Project detail'} at ${item.projectName}`} className="aspect-[4/3] w-full rounded-xl object-cover" />}
    <figcaption className="mt-2"><p className="folio-ui">{item.projectName}{item.roomName ? ` · ${item.roomName}` : ''}</p>{!compact && !item.text.includes("Designer-verified image attributes:") && <p className="folio-meta mt-1 text-folio-text-secondary">{item.text}</p>}{!compact && item.photographer && <p className="folio-meta mt-1">Photography: {item.photographer}</p>}{item.visibility === 'private' && <p className="folio-meta mt-1">Private evidence · public permission required</p>}</figcaption>
  </figure>)}</div>;
}
