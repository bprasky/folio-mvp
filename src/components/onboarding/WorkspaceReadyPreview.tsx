import OrgProfileHero from '@/components/org-profile/OrgProfileHero';
import FlowMosaic from '@/components/feed/FlowMosaic';
import { profilePageStyle, type OrgAppearanceData } from '@/lib/org-profile-appearance';
import profileStyles from '@/components/org-profile/OrgProfileAppearance.module.css';
import type { WorkspacePreviewProject } from '@/lib/workspace-import/types';

export type WorkspaceProfilePreview = Pick<OrgAppearanceData, 'org' | 'appearance' | 'cover' | 'projectCount'>;

type Props = {
  profile: WorkspaceProfilePreview; personName: string; description: string; location: string;
  logo?: string | null; bio: string; projects: WorkspacePreviewProject[]; busy: boolean; canContribute: boolean;
  onOpenProject: (id: string, action: 'open' | 'schedule' | 'tag') => void;
  onReviewDetails: () => void;
};

// Only used for automatic covers in this owner-only preview. Saved appearance
// choices stay authoritative; no draft photograph enters the public profile.
export function workspaceCover(projects: WorkspacePreviewProject[]) {
  const photos = projects.flatMap(project => project.photos.map(photo => ({ ...photo, projectTitle: project.title })));
  const score = (photo: typeof photos[number]) => photo.width && photo.height
    ? Math.min(photo.width * photo.height, 8_000_000) * (photo.width >= photo.height ? 2 : 1) : 0;
  return photos.reduce<typeof photos[number] | undefined>((best, photo) => !best || score(photo) > score(best) ? photo : best, undefined);
}

export function WorkspaceReadyPreview({ profile, personName, description, location, logo, bio, projects, busy, canContribute, onOpenProject, onReviewDetails }: Props) {
  const automaticCover = workspaceCover(projects);
  const cover = profile.appearance.cover.kind === 'auto' && automaticCover ? automaticCover : profile.cover;
  const org = { ...profile.org, description, location, logo: logo ?? null };
  const first = canContribute ? projects.find(project => !project.isPublic && project.photos.length) : undefined;
  const action = (project: WorkspacePreviewProject) => canContribute && !project.isPublic && project.photos.length ? 'tag' : 'open';
  const items = projects.map(project => ({
    id: project.id, title: project.title, imageUrl: project.photos[0]?.url, isDraft: !project.isPublic,
    actionLabel: project.isPublic || !canContribute ? 'Open project' : project.photos.length ? 'Add materials' : 'Add photographs',
  }));
  return <section className={`workspace-preview ${profileStyles.page}`} style={profilePageStyle(profile.appearance.backgroundColor)} aria-label="Your private profile preview">
    <div className="workspace-preview__welcome">
      <div><p className="workspace-preview__eyebrow">Your private preview</p><h1 className="folio-h2">Your work, already taking shape.</h1></div>
      <a href="#profile-details" onClick={onReviewDetails}>Review imported details</a>
    </div>
    <OrgProfileHero org={org} appearance={profile.appearance} cover={cover}
      projectCount={profile.projectCount + projects.filter(project => !project.isPublic).length} year={new Date().getFullYear()} preview />
    {first ? <div className={`workspace-preview__next ${profileStyles.neutralContent}`}>
      <div><p className="workspace-preview__eyebrow">Next: materials & sourcebook · Then: your interview</p>
        <h2>Add materials to {first.title}.</h2>
        <p>Upload a finish schedule or tag products in your photos. Review and place them to build your sourcebook. Together with your photographs, those materials help us prepare a conversation about the thinking behind your work.</p>
      </div>
      <div className="workspace-preview__next-actions">
        <button type="button" className="auth-submit" disabled={busy} onClick={() => onOpenProject(first.id, 'schedule')}>Upload a finish schedule <span aria-hidden="true">↗</span></button>
        <button type="button" className="auth-secondary" disabled={busy} onClick={() => onOpenProject(first.id, 'tag')}>Tag products manually</button>
      </div>
    </div> : <p className="workspace-preview__empty">{projects.length ? 'Your projects are here. Open one below to continue.' : 'Review your imported details, then add photographs to begin your first project.'}</p>}
    {projects.length ? <section className="workspace-preview__projects" aria-label="Your imported projects">
      <div className="workspace-preview__section-heading"><h2>Your projects</h2><p>Private drafts are yours to shape. Publish when you’re ready.</p></div>
      <FlowMosaic events={items} preserveOrder disabled={busy} onSelect={id => {
        const project = projects.find(candidate => candidate.id === id);
        if (project) onOpenProject(id, action(project));
      }} />
    </section> : null}
    {description || bio ? <div className={`workspace-preview__about ${profileStyles.neutralContent}`}>
      {description ? <section><h2 className="workspace-preview__eyebrow">About the practice</h2><p className="workspace-preview__description">{description}</p></section> : null}
      {bio ? <section><h2 className="workspace-preview__eyebrow">{personName || 'Your background'}</h2><p className="workspace-preview__description">{bio}</p></section> : null}
    </div> : null}
  </section>;
}
