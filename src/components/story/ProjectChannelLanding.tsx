import Link from 'next/link';
import { ProjectChannelHeroPhotos } from './ProjectChannelHeroPhotos';
import { ProjectChannelMosaic } from './ProjectChannelMosaic';
import type { ChannelTile } from '@/lib/project-channel/curation';

type PublicImage = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null };
type ProjectChannelPost = {
  slug: string; excerpt?: string | null; heroAssetId?: string | null;
  credits?: Array<{ role?: string | null; name?: string | null }>;
  project: { title: string; description?: string | null; city?: string | null; regionState?: string | null;
    images: PublicImage[]; designer?: { name?: string | null; studio?: string | null } | null };
};

/** A single public project destination. The published interview is its featured entry. */
export function ProjectChannelLanding({ post, media = [], ownerView = false }: {
  post: ProjectChannelPost;
  media?: ChannelTile[];
  ownerView?: boolean;
}) {
  const images = post.project.images || [];
  const hero = images.find(image => image.id === post.heroAssetId) || images[0];
  const featureHref = `/p/${encodeURIComponent(post.slug)}/feature`;
  const designer = post.project.designer?.studio || post.project.designer?.name || 'Folio';
  const slideshow = [hero, ...images.filter(image => image.id !== hero?.id)].filter((image): image is PublicImage => Boolean(image)).slice(0, 5);
  const seenRooms = new Set<string>();
  const spaceTiles: ChannelTile[] = images.filter(image => {
    const key = image.roomId || image.room || image.id;
    if (seenRooms.has(key)) return false;
    seenRooms.add(key); return true;
  }).map(image => ({
    id: image.id, kind: 'space', title: image.room || image.name || 'Project photograph',
    imageUrl: image.url, href: featureHref, roomKey: image.roomId || image.room || image.id,
  }));
  // Existing approved interviews are already PUBLISHED in the canonical post model:
  // their feature must appear in the hero AND receive prominent mosaic placement.
  const tiles: ChannelTile[] = [
    { id: `feature-${post.slug}`, kind: 'feature', title: post.excerpt || 'The Folio Feature',
      imageUrl: hero?.url || null, href: featureHref },
    ...media,
    ...spaceTiles,
    ...(post.credits || []).filter(credit => credit.name).map((credit, index): ChannelTile => ({
      id: `credit-${index}`, kind: 'credit', title: `${credit.name}${credit.role ? ` · ${credit.role}` : ''}`,
      imageUrl: null, href: '#project-mosaic',
    })),
  ];
  return <main className="min-h-screen bg-[#171715] text-[#f4efe7]">
    <section className="relative isolate min-h-[min(78vh,820px)] overflow-hidden bg-[#292722]" aria-label={post.project.title}>
      {slideshow.length > 0 && <ProjectChannelHeroPhotos images={slideshow} title={post.project.title} />}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="relative mx-auto flex min-h-[min(78vh,820px)] max-w-7xl flex-col justify-end px-5 pb-14 pt-28 sm:px-10 lg:pb-20">
        <p className="mb-4 text-[11px] uppercase tracking-[.3em] text-white/75">A Folio project</p>
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.03] tracking-tight sm:text-7xl lg:text-8xl">{post.project.title}</h1>
        <p className="mt-5 text-xs uppercase tracking-[.23em] text-white/85">By {designer}</p>
        {(post.excerpt || post.project.description) && <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85">{post.excerpt || post.project.description}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={featureHref} className="inline-flex min-h-11 items-center rounded-full bg-[#f4efe7] px-6 text-sm font-medium text-[#171715] hover:bg-white">Read the Folio Feature</Link>
          {spaceTiles.length > 0 && <a href="#project-mosaic" className="inline-flex min-h-11 items-center rounded-full border border-white/60 px-6 text-sm text-white hover:bg-white/10">View spaces</a>}
        </div>
        {(post.project.city || post.project.regionState) && <p className="mt-8 text-xs tracking-wide text-white/70">{[post.project.city, post.project.regionState].filter(Boolean).join(', ')}</p>}
      </div>
    </section>
    <section id="project-mosaic" className="scroll-mt-20">
      <ProjectChannelMosaic tiles={tiles} ownerView={ownerView} />
    </section>
  </main>;
}
