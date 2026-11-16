import Link from 'next/link';
import { ProjectChannelHeroPhotos } from './ProjectChannelHeroPhotos';
import { ProjectChannelMosaic } from './ProjectChannelMosaic';
import type { ChannelTile } from '@/lib/project-channel/curation';
import { projectChannelHref, withChannelQuery, type ChannelSearchParams } from '@/lib/project-channel/links';
import { buildStoryData } from '@/lib/story/buildRoomTiles';
import styles from './ProjectChannel.module.css';

type PublicImage = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null };
type Credit = { role?: string | null; name?: string | null; url?: string | null };
export type ProjectChannelPost = {
  slug?: string; status?: string; excerpt?: string | null; heroAssetId?: string | null;
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
  const hasFeature = post.status === 'PUBLISHED' && Boolean(post.slug);
  const story = hasFeature ? buildStoryData(post) : null;
  const photoRooms = new Map<string, { key: string; label: string }>();
  for (const room of story?.roomTiles || []) {
    for (const image of [room.heroImage, ...room.additionalImages]) {
      photoRooms.set(image.id, { key: room.roomId || room.roomSlug, label: room.roomLabel });
    }
  }
  const hero = images.find(image => image.id === post.heroAssetId) || images[0];
  const featurePath = hasFeature ? `${projectChannelHref(post.slug!)}/feature` : '';
  const featureHref = withChannelQuery(featurePath, searchParams);
  const designer = post.project.designerOrg?.name || post.project.designer?.studio || post.project.designer?.name || 'Folio';
  const slideshow = [hero, ...images.filter(image => image.id !== hero?.id)].filter((image): image is PublicImage => Boolean(image)).slice(0, 5);
  const spaceTiles: ChannelTile[] = [hero, ...images.filter(image => image.id !== hero?.id)].filter((image): image is PublicImage => Boolean(image)).map(image => ({
    id: image.id, kind: 'space', title: photoRooms.get(image.id)?.label || image.room || image.name || 'Project photograph',
    imageUrl: image.url, href: hasFeature ? withChannelQuery(featurePath, { ...searchParams, room: photoRooms.get(image.id)?.key, photo: image.id }) : null,
    roomKey: photoRooms.get(image.id)?.key || image.roomId || image.room || image.id,
  }));
  const seenCredits = new Set<string>();
  const approvedCredits = hasFeature ? (post.credits?.length ? post.credits : post.expandedBlocks?.credits || []) : [];
  const credits = approvedCredits.flatMap((credit, index): ChannelTile[] => {
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
    ...(hasFeature ? [{ id: `feature-${post.slug}`, kind: 'feature' as const, title: story?.title || 'The Folio Feature',
      imageUrl: hero?.url || null, href: featureHref, roomKey: photoRooms.get(hero?.id)?.key || hero?.roomId || hero?.room || hero?.id }] : []),
    ...media,
    ...spaceTiles,
    ...credits,
  ];
  return <main className={styles.channel}>
    <section className={styles.hero} aria-label={post.project.title}>
      {slideshow.length > 0 && <ProjectChannelHeroPhotos key={slideshow.map(image => image.id).join(':')} images={slideshow} title={post.project.title} />}
      <div aria-hidden="true" className={styles.heroShade} />
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>A Folio project</p>
        <h1 className={styles.title}>{post.project.title}</h1>
        <p className={styles.byline}>By {designer}</p>
        {(hasFeature ? post.excerpt || post.project.description : post.project.description) && <p className={styles.deck}>{hasFeature ? post.excerpt || post.project.description : post.project.description}</p>}
        <div className={styles.actions}>
          {hasFeature && <Link href={featureHref} className={styles.primaryAction}>Read the Folio Feature <span aria-hidden="true">↗</span></Link>}
          {spaceTiles.length > 0 && <a href="#project-mosaic" className={hasFeature ? styles.secondaryAction : styles.primaryAction}>Explore the spaces <span aria-hidden="true">↓</span></a>}
        </div>
        {(post.project.city || post.project.regionState) && <p className={styles.location}>{[post.project.city, post.project.regionState].filter(Boolean).join(', ')}</p>}
      </div>
    </section>
    <section id="project-mosaic" className="scroll-mt-20">
      <ProjectChannelMosaic tiles={tiles} ownerView={ownerView} projectTitle={post.project.title} />
    </section>
  </main>;
}
