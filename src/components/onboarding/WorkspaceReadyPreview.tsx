import type { WorkspacePreviewProject } from '@/lib/workspace-import/types';

type Props = {
  name: string; personName: string; website: string; description: string; location: string;
  logo?: string | null; bio: string; projects: WorkspacePreviewProject[]; busy: boolean; canContribute: boolean;
  onOpenProject: (id: string, action: 'open' | 'schedule' | 'tag') => void;
  onReviewDetails: () => void;
};

// Prefer a large landscape image for the cover; preserve source order on ties
// and for older imports that have no recorded image dimensions.
export function workspaceCover(projects: WorkspacePreviewProject[]) {
  const photos = projects.flatMap(project => project.photos);
  const score = (photo: typeof photos[number]) => photo.width && photo.height
    ? Math.min(photo.width * photo.height, 8_000_000) * (photo.width >= photo.height ? 2 : 1) : 0;
  return photos.reduce<typeof photos[number] | undefined>((best, photo) => !best || score(photo) > score(best) ? photo : best, undefined);
}

export function WorkspaceReadyPreview({ name, personName, website, description, location, logo, bio, projects, busy, canContribute, onOpenProject, onReviewDetails }: Props) {
  const cover = workspaceCover(projects);
  const first = canContribute ? projects.find(project => !project.isPublic && project.photos.length) : undefined;
  const photos = projects.reduce((count, project) => count + project.photos.length, 0);
  return <section className="workspace-preview" aria-label="Your private profile preview">
    <div className="workspace-preview__welcome"><div><p className="workspace-preview__eyebrow">A head start, made for you</p><h1 className="folio-h2">Welcome to your Folio.</h1></div><div className="workspace-preview__welcome-action"><p>Your work is here. Next, add the materials behind it.</p>{first ? <button type="button" disabled={busy} onClick={() => onOpenProject(first.id, 'tag')}>Add project materials <span aria-hidden="true">↗</span></button> : null}</div></div>
    <div className={`workspace-preview__cover${cover ? '' : ' workspace-preview__cover--empty'}`}>
      {cover ? <>
        {/* Session-protected project photography must load directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.url} alt={cover.alt || 'Imported project photograph'} />
      </> : null}
      <span className="workspace-preview__private">Private profile preview</span>
      <div className="workspace-preview__identity">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="workspace-preview__logo" src={logo} alt={`${name} logo`} />
        ) : <span className="workspace-preview__monogram" aria-hidden="true">{name.slice(0, 1)}</span>}
        <div><h2>{name}</h2><p>{location || 'Your practice on Folio'}</p><a href={website} target="_blank" rel="noreferrer">{new URL(website).hostname.replace(/^www\./, '')}</a></div>
      </div>
    </div>
    <div className="workspace-preview__summary"><span><strong>{projects.length}</strong> {projects.length === 1 ? 'project' : 'projects'} brought over</span><span><strong>{photos}</strong> {photos === 1 ? 'photograph' : 'photographs'} in your workspace</span><a href="#profile-details" onClick={onReviewDetails}>Review profile details</a></div>
    {first ? <div className="workspace-preview__next"><div><p className="workspace-preview__eyebrow">Next: materials & sourcebook · Then: your interview</p><h2>Add materials to {first.title}.</h2><p>Upload a finish schedule or tag products in your photos. Review and place them to build your sourcebook. Together with your photographs, those materials help us prepare a conversation about the thinking behind your work.</p></div><div className="workspace-preview__next-actions"><button type="button" className="auth-submit" disabled={busy} onClick={() => onOpenProject(first.id, 'schedule')}>Upload a finish schedule <span aria-hidden="true">↗</span></button><button type="button" className="auth-secondary" disabled={busy} onClick={() => onOpenProject(first.id, 'tag')}>Tag products manually</button></div></div> : <p className="folio-body">{projects.length ? 'Your projects are here. Open one below to continue.' : 'Your profile has a starting point. Review it below, then add photographs to begin your first project.'}</p>}
    {description || bio ? <div className="workspace-preview__about">
      {description ? <section><p className="workspace-preview__eyebrow">About the practice</p><p className="workspace-preview__description">{description}</p></section> : null}
      {bio ? <section><p className="workspace-preview__eyebrow">{personName || 'Your background'}</p><p className="workspace-preview__description">{bio}</p></section> : null}
    </div> : null}
    {projects.length ? <section className="workspace-preview__projects"><div className="workspace-preview__section-heading"><h2>Your projects</h2><p>Private drafts are yours to shape. Publish when you’re ready.</p></div><div className="workspace-preview__grid">{projects.map(project => <article key={project.id} className={`workspace-preview__project${project.isPublic ? '' : ' workspace-preview__project--draft'}`}>
      <button type="button" className="workspace-preview__project-link" disabled={busy} onClick={() => onOpenProject(project.id, canContribute && !project.isPublic && project.photos.length > 0 ? 'tag' : 'open')}>
        <div className="workspace-preview__project-image">
          {project.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.photos[0].url} alt={project.photos[0].alt || project.title} loading="lazy" />
          ) : <span>Room for your photographs</span>}
          <span className="workspace-preview__draft-label">{project.isPublic ? 'Published' : 'Private draft'}</span>
        </div>
        <div className="workspace-preview__project-caption"><h3>{project.title}</h3><span>{project.isPublic || !canContribute ? 'Open project' : project.photos.length ? 'Add materials' : 'Add photographs'} <span aria-hidden="true">↗</span></span></div>
      </button>
    </article>)}</div></section> : null}
  </section>;
}
