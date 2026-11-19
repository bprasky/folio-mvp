'use client';

import { useState, type ReactNode } from 'react';
import OrgProfileHero from '@/components/org-profile/OrgProfileHero';
import FlowMosaic from '@/components/feed/FlowMosaic';
import { profilePageStyle, type OrgAppearanceData, type OrgProfileAppearance, type ProfileCover } from '@/lib/org-profile-appearance';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import OrgCoverEditor from '@/components/org-profile/OrgCoverEditor';
import { OrgAboutTab } from '@/components/org-onboarding';
import profileStyles from '@/components/org-profile/OrgProfileAppearance.module.css';
import type { WorkspacePreviewProject } from '@/lib/workspace-import/types';

export type WorkspaceProfilePreview = Pick<OrgAppearanceData, 'org' | 'appearance' | 'cover' | 'projectCount'>;

type Props = {
  profile: WorkspaceProfilePreview; description: string; location: string; logo?: string | null;
  projects: WorkspacePreviewProject[]; busy: boolean; canContribute: boolean;
  onOpenProject: (id: string, reviewPhotos: boolean) => void;
  children: ReactNode;
  importId?: string; canEditProfile?: boolean;
};

// Only used for automatic covers in this owner-only preview. Saved appearance
// choices stay authoritative; no draft photograph enters the public profile.
export function workspaceCover(projects: WorkspacePreviewProject[]) {
  const photos = projects.flatMap(project => project.photos.map(photo => ({ ...photo, projectTitle: project.title })));
  const score = (photo: typeof photos[number]) => photo.width && photo.height
    ? Math.min(photo.width * photo.height, 8_000_000) * (photo.width >= photo.height ? 2 : 1) : 0;
  return photos.reduce<typeof photos[number] | undefined>((best, photo) => !best || score(photo) > score(best) ? photo : best, undefined);
}

export function WorkspaceReadyPreview({ profile, description, location, logo, projects, busy, canContribute, canEditProfile = false, importId, onOpenProject, children }: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tab, setTab] = useState<'feed' | 'about'>('feed');
  const [savedAppearance, setSavedAppearance] = useState<OrgProfileAppearance | null>(null);
  const [savedCover, setSavedCover] = useState<ProfileCover>(null);
  const appearance = savedAppearance || profile.appearance;
  const automaticCover = workspaceCover(projects);
  const cover = appearance.cover.kind === 'auto' && automaticCover ? automaticCover : appearance.cover.kind === 'none' ? null : savedAppearance ? savedCover : profile.cover;
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
    <OrgProfileHero org={org} appearance={appearance} cover={cover}
      tools={<div className={profileStyles.inlineControls}>
        {canEditProfile && <OrgCoverEditor orgId={org.id} importId={importId} previewCover={automaticCover || null} onSaved={(nextAppearance, nextCover) => { setSavedAppearance(nextAppearance); setSavedCover(nextCover); }} />}
        <button type="button" className={profileStyles.manageTrigger} onClick={() => setReviewOpen(true)}>Review &amp; publish</button>
      </div>}
      projectCount={profile.projectCount + projects.filter(project => !project.isPublic).length} year={new Date().getFullYear()} preview />
    <nav className="flex gap-7 border-b border-folio-border-subtle py-4" aria-label="Profile preview tabs">
      <button type="button" className="min-h-11" aria-current={tab === 'feed' ? 'page' : undefined} onClick={() => setTab('feed')}>Feed</button>
      <button type="button" className="min-h-11" aria-current={tab === 'about' ? 'page' : undefined} onClick={() => setTab('about')}>About</button>
    </nav>
    {tab === 'about' && <OrgAboutTab org={org} team={[]} isOwner={false} />}
    {tab === 'feed' && projects.length > 0 && <section className="workspace-preview__projects" aria-label="Your imported projects">
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
    <Dialog open={reviewOpen} onOpenChange={value => { if (!busy) setReviewOpen(value); }} placement="right">
      <DialogContent placement="right" className={profileStyles.manageSheet}>
        <div className={profileStyles.sheetHeader}><div><DialogTitle>Review your import</DialogTitle><DialogDescription>Confirm photographs together, then review your studio details and media.</DialogDescription></div>
          <button type="button" disabled={busy} className={profileStyles.textButton} onClick={() => setReviewOpen(false)}>Close</button></div>
        <div className="p-6">{children}</div>
      </DialogContent>
    </Dialog>
  </section>;
}
