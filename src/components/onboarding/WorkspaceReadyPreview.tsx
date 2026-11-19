import type { ReactNode } from 'react';
import OrgProfileHero from '@/components/org-profile/OrgProfileHero';
import FlowMosaic from '@/components/feed/FlowMosaic';
import { profilePageStyle, type OrgAppearanceData } from '@/lib/org-profile-appearance';
import profileStyles from '@/components/org-profile/OrgProfileAppearance.module.css';
import type { WorkspacePreviewProject } from '@/lib/workspace-import/types';

export type WorkspaceProfilePreview = Pick<OrgAppearanceData, 'org' | 'appearance' | 'cover' | 'projectCount'>;

type Props = {
  profile: WorkspaceProfilePreview; description: string; location: string; logo?: string | null;
  projects: WorkspacePreviewProject[]; busy: boolean; canContribute: boolean;
  onOpenProject: (id: string, reviewPhotos: boolean) => void;
  children: ReactNode;
};

// Only used for automatic covers in this owner-only preview. Saved appearance
// choices stay authoritative; no draft photograph enters the public profile.
export function workspaceCover(projects: WorkspacePreviewProject[]) {
  const photos = projects.flatMap(project => project.photos.map(photo => ({ ...photo, projectTitle: project.title })));
  const score = (photo: typeof photos[number]) => photo.width && photo.height
    ? Math.min(photo.width * photo.height, 8_000_000) * (photo.width >= photo.height ? 2 : 1) : 0;
  return photos.reduce<typeof photos[number] | undefined>((best, photo) => !best || score(photo) > score(best) ? photo : best, undefined);
}

export function WorkspaceReadyPreview({ profile, description, location, logo, projects, busy, canContribute, onOpenProject, children }: Props) {
  const automaticCover = workspaceCover(projects);
  const cover = profile.appearance.cover.kind === 'auto' && automaticCover ? automaticCover : profile.cover;
  const org = { ...profile.org, description, location, logo: logo ?? null };
  const photographed = projects.filter(project => project.photos.length).map(project => ({
    id: project.id, title: project.title, imageUrl: project.photos[0].url, isDraft: !project.isPublic,
    actionLabel: project.isPublic || !canContribute ? 'Open project' : 'Review photographs',
  }));
  const withoutPhotos = projects.filter(project => !project.photos.length);
  const open = (id: string) => {
    const project = projects.find(candidate => candidate.id === id);
    if (project) onOpenProject(id, canContribute && !project.isPublic && project.photos.length > 0);
  };
  return <section className={`workspace-preview ${profileStyles.page}`} style={profilePageStyle(profile.appearance.backgroundColor)} aria-label="Your private profile preview">
    <div className="workspace-preview__welcome">
      <div><p className="workspace-preview__eyebrow">Your private preview</p><h1 className="folio-h2">Your work, already taking shape.</h1></div>
    </div>
    <OrgProfileHero org={org} appearance={profile.appearance} cover={cover}
      projectCount={profile.projectCount + projects.filter(project => !project.isPublic).length} year={new Date().getFullYear()} preview />
    {children}
    {projects.length > 0 && <section className="workspace-preview__projects" aria-label="Your imported projects">
      <div className="workspace-preview__section-heading"><h2>Your projects</h2><p>{projects.length} {projects.length === 1 ? 'project' : 'projects'} from your website</p></div>
      {photographed.length > 0 && <FlowMosaic events={photographed.slice(0, 4)} preserveOrder disabled={busy} onSelect={open} />}
      {photographed.length > 4 && <details className="workspace-preview__more"><summary>Show {photographed.length - 4} more {photographed.length === 5 ? 'project' : 'projects'}</summary>
        <FlowMosaic events={photographed.slice(4)} preserveOrder disabled={busy} onSelect={open} />
      </details>}
      {!!withoutPhotos.length && <ul className="workspace-preview__list">{withoutPhotos.map(project => <li key={project.id}>
        <button type="button" disabled={busy} onClick={() => open(project.id)}>
          <span>{project.title}<small>{project.isPublic ? 'Published' : 'Private draft'}</small></span>
          <span>{canContribute ? 'Add photographs' : 'Open project'} <span aria-hidden="true">→</span></span>
        </button></li>)}</ul>}
    </section>}
  </section>;
}
