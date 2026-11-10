import SafeImage from '@/components/SafeImage';

type PublicImage = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null };
type ProjectChannelPost = {
  slug: string;
  title?: string | null;
  excerpt?: string | null;
  heroAssetId?: string | null;
  project: {
    title: string;
    description?: string | null;
    city?: string | null;
    regionState?: string | null;
    images: PublicImage[];
    designer?: { name?: string | null; studio?: string | null } | null;
  };
};

function uniqueRooms(images: PublicImage[]) {
  const seen = new Set<string>();
  return images.filter(image => {
    const key = image.roomId || image.room;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

/** Editorial entry to the existing approved publication, not a new publication source. */
export function ProjectChannelLanding({ post }: { post: ProjectChannelPost }) {
  const images = post.project.images || [];
  const hero = images.find(image => image.id === post.heroAssetId) || images[0];
  const rooms = uniqueRooms(images);
  const designer = post.project.designer?.studio || post.project.designer?.name || 'Folio';
  return (
    <section aria-label={`Explore ${post.project.title}`} className="bg-[#171715] text-[#f4efe7]">
      <div className="relative isolate min-h-[min(78vh,820px)] overflow-hidden bg-[#292722]">
        {hero && <SafeImage src={hero.url} alt={hero.name || post.project.title} fill priority sizes="100vw" className="object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="relative mx-auto flex min-h-[min(78vh,820px)] max-w-7xl flex-col justify-end px-5 pb-14 pt-28 sm:px-10 lg:pb-20">
          <p className="mb-4 text-[11px] uppercase tracking-[.3em] text-white/75">A Folio project</p>
          <h1 className="max-w-3xl font-serif text-5xl leading-[1.03] tracking-tight sm:text-7xl lg:text-8xl">{post.project.title}</h1>
          <p className="mt-5 text-xs uppercase tracking-[.23em] text-white/85">By {designer}</p>
          {(post.excerpt || post.project.description) && <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85">{post.excerpt || post.project.description}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#project-publication" className="inline-flex min-h-11 items-center rounded-full bg-[#f4efe7] px-6 text-sm font-medium text-[#171715] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Explore the story</a>
            {rooms.length > 0 && <a href="#channel-spaces" className="inline-flex min-h-11 items-center rounded-full border border-white/60 px-6 text-sm text-white hover:bg-white/10">Explore spaces</a>}
          </div>
          {(post.project.city || post.project.regionState) && <p className="mt-8 text-xs tracking-wide text-white/70">{[post.project.city, post.project.regionState].filter(Boolean).join(', ')}</p>}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-10">
        <div className="flex flex-wrap gap-6 border-b border-white/20 pb-5 text-sm">
          <a href="#project-publication" className="hover:underline">The Story</a>
          {rooms.length > 0 && <a href="#channel-spaces" className="hover:underline">Spaces</a>}
          <a href="#project-publication" className="text-white/70 hover:underline">Design details</a>
        </div>
        {rooms.length > 0 && <section id="channel-spaces" className="scroll-mt-24 pt-10">
          <h2 className="mb-5 font-serif text-3xl sm:text-4xl">Explore the Spaces</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {rooms.map(image => <a key={image.id} href={`#project-publication`} className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-[#38352f]">
              <SafeImage src={image.url} alt={image.name || image.room || 'Project room'} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <span className="absolute bottom-4 left-4 right-4 font-serif text-lg">{image.room || 'Explore room'}</span>
            </a>)}
          </div>
        </section>}
        <p className="mt-8 text-sm text-white/65">Photography and editorial from the approved project publication. Additional stories and episodes appear only when published.</p>
      </div>
    </section>
  );
}
