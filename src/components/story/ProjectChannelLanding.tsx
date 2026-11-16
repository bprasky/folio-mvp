import Link from 'next/link';
import { ProjectChannelHeroPhotos } from './ProjectChannelHeroPhotos';
import { ProjectChannelMosaic } from './ProjectChannelMosaic';
import type { ChannelTile } from '@/lib/project-channel/curation';
import { projectChannelHref, withChannelQuery, type ChannelSearchParams } from '@/lib/project-channel/links';
import { buildStoryData } from '@/lib/story/buildRoomTiles';

type PublicImage = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null };
type Credit = { role?: string | null; name?: string | null; url?: string | null };
type ProjectChannelPost = {
  slug: string; excerpt?: string | null; heroAssetId?: string | null;
  credits?: Credit[];
  expandedBlocks?: { headline?: string | null; lead?: { title?: string | null }; credits?: Credit[] };
  project: { title: string; description?: string | null; city?: string | null; regionState?: string | null;
    images: PublicImage[]; designer?: { name?: string | null; studio?: string | null } | null; designerOrg?: { name?: string | null } | null };
};

function creditLink(value?: string | null): string | null {
  if (!value || !/^(https?:\/\/|\/(org|monograph|photographer)\/)/i.test(value)) return null;
  try {
    const url = new URL(value, 'https://folioad.com');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** A single public project destination. The published interview is its featured entry. */
export function ProjectChannelLanding({ post, media = [], ownerView = false, searchParams }: {
  post: ProjectChannelPost;
  media?: ChannelTile[];
  ownerView?: boolean;
  searchParams?: ChannelSearchParams;
}) {
  const images = (post.project.images || []).filter(image => image.url);
  const story = buildStoryData(post);
  const photoRooms = new Map<string, { key: string; label: string }>();
  for (const room of story?.roomTiles || []) {
    for (const image of [room.heroImage, ...room.additionalImages]) {
      photoRooms.set(image.id, { key: room.roomId || room.roomSlug, label: room.roomLabel });
    }
  }
  const hero = images.find(image => image.id === post.heroAssetId) || images[0];
  const featurePath = `${projectChannelHref(post.slug)}/feature`;
  const featureHref = withChannelQuery(featurePath, searchParams);
  const designer = post.project.designerOrg?.name || post.project.designer?.studio || post.project.designer?.name || 'Folio';
  const slideshow = [hero, ...images.filter(image => image.id !== hero?.id)].filter((image): image is PublicImage => Boolean(image)).slice(0, 5);
  const spaceTiles: ChannelTile[] = [hero, ...images.filter(image => image.id !== hero?.id)].filter((image): image is PublicImage => Boolean(image)).map(image => ({
    id: image.id, kind: 'space', title: photoRooms.get(image.id)?.label || image.room || image.name || 'Project photograph',
    imageUrl: image.url, href: photoRooms.has(image.id) ? withChannelQuery(featurePath, { ...searchParams, room: photoRooms.get(image.id)!.key }) : featureHref,
    roomKey: photoRooms.get(image.id)?.key || image.roomId || image.room || image.id,
  }));
  const seenCredits = new Set<string>();
  const credits = (post.credits?.length ? post.credits : post.expandedBlocks?.credits || []).flatMap((credit, index): ChannelTile[] => {
    const name = typeof credit.name === 'string' ? credit.name.trim() : '';
    const role = typeof credit.role === 'string' ? credit.role.trim() : '';
    const key = `${name?.toLowerCase()}|${role?.toLowerCase() || ''}`;
    if (!name || seenCredits.has(key)) return [];
    seenCredits.add(key);
    return [{ id: `credit-${index}`, kind: 'credit', title: `${name}${role ? ` · ${role}` : ''}`, imageUrl: null, href: creditLink(credit.url) }];
  });
  // Existing approved interviews are already PUBLISHED in the canonical post model:
  // their feature must appear in the hero AND receive prominent mosaic placement.
  const tiles: ChannelTile[] = [
    { id: `feature-${post.slug}`, kind: 'feature', title: story?.title || 'The Folio Feature',
      imageUrl: hero?.url || null, href: featureHref, roomKey: photoRooms.get(hero?.id)?.key || hero?.roomId || hero?.room || hero?.id },
    ...media,
    ...spaceTiles,
    ...credits,
  ];
  return <main className="min-h-screen bg-[#171715] text-[#f4efe7]">
    <section className="relative isolate min-h-[min(78vh,820px)] overflow-hidden bg-[#292722]" aria-label={post.project.title}>
      {slideshow.length > 0 && <ProjectChannelHeroPhotos key={slideshow.map(image => image.id).join(':')} images={slideshow} title={post.project.title} />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      <div className="pointer-events-none relative mx-auto flex min-h-[min(78vh,820px)] max-w-7xl flex-col justify-end px-5 pb-20 pt-28 sm:px-10 lg:pb-20 [&_a]:pointer-events-auto">
        <p className="mb-4 text-[length:var(--type-eyebrow)] uppercase tracking-[var(--ls-eyebrow)] text-white/75">A Folio project</p>
        <h1 className="max-w-3xl break-words text-[#f4efe7] font-serif text-5xl leading-[var(--lh-h1)] tracking-tight sm:text-7xl lg:text-8xl">{post.project.title}</h1>
        <p className="mt-5 text-xs uppercase tracking-[var(--ls-eyebrow)] text-white/85">By {designer}</p>
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
