'use client';

import { useRef, useState } from 'react';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Download, FileText, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectSocialPanel } from '@/components/publishing-studio/ProjectSocialPanel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ExportSpecModal from './ExportSpecModal';
import OverviewModal from './OverviewModal';
import type { ProjectHeaderProps } from './ProjectHeader';

type Props = {
  project: ProjectHeaderProps['project'] & { isPublic: boolean; description?: string | null };
  slug: string | null;
  coverUrl: string | null;
  canUseSocialTools: boolean;
};

export default function PublishedProjectHome({ project, slug, coverUrl, canUseSocialTools }: Props) {
  const router = useRouter();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isOpeningDraft, setIsOpeningDraft] = useState(false);
  const openingDraft = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (
    scope: 'current' | 'all',
    format: 'xlsx' | 'pdf',
    roomId?: string,
  ) => {
    try {
      const params = new URLSearchParams({ scope, format });
      if (roomId) {
        params.set('roomId', roomId);
      }

      const response = await fetch(
        `/api/projects/${project.id}/export-spec?${params.toString()}`,
        { method: 'POST' },
      );

      if (!response.ok) {
        // Surface the route's real status + { error } body instead of a
        // generic failure, so the actual cause (401/403/404/500) is visible.
        let serverMessage = '';
        try {
          serverMessage = ((await response.json()) as { error?: string })?.error || '';
        } catch {
          /* non-JSON body */
        }
        throw new Error(
          `Export failed (${response.status})${serverMessage ? `: ${serverMessage}` : ''}`,
        );
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `folio-spec-${project.id}-${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"\r\n]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export ready');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export spec');
      throw error;
    }
  };


  async function openDraft() {
    if (openingDraft.current) return;
    openingDraft.current = true;
    setShowEditDialog(false);
    setIsOpeningDraft(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/posting/project/${project.id}/status`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unpublish' }) },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || result.message || 'Unable to open the draft. Please try again.');
      }
      router.push(`/project/${project.id}?view=publish`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open the draft.');
    } finally {
      openingDraft.current = false;
      setIsOpeningDraft(false);
    }
  }

  const cardClass = 'flex flex-col items-start gap-3 rounded-[20px] border border-folio-border-subtle bg-surface-canvas p-6 text-left transition-colors hover:border-folio-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

  return (
    <section aria-label="Project home" className="space-y-8">
      {error && <p role="alert" className="folio-ui text-folio-text-primary">{error}</p>}
      <div className={`grid overflow-hidden rounded-[20px] border border-folio-border-subtle bg-surface-ground ${coverUrl ? 'md:grid-cols-2' : ''}`}>
        {coverUrl && (
          <div className="relative min-h-64 md:min-h-80">
            <Image src={coverUrl} alt={project.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        )}
        <div className="flex flex-col justify-center gap-5 p-8 md:p-10">
          <p className="folio-meta uppercase tracking-widest text-folio-text-secondary">Your published project</p>
          <h2 className="folio-h2 text-folio-text-primary">Ready to share</h2>
          <p className="folio-body text-folio-text-secondary">Your story is live on Folio. Share it, prepare social posts, or take your product list with you.</p>
          <div className="flex flex-wrap items-center gap-3">
            {slug && <Link href={`/p/${slug}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 folio-ui text-white hover:bg-[var(--accent-hover)]">View published story <ArrowUpRight className="h-4 w-4" /></Link>}
            <button type="button" onClick={() => setShowEditDialog(true)} disabled={isOpeningDraft} className="inline-flex items-center gap-2 rounded-full border border-folio-border-subtle px-5 py-3 folio-ui hover:border-folio-border-strong disabled:opacity-50"><Pencil className="h-4 w-4" />{isOpeningDraft ? 'Opening draft…' : 'Edit project'}</button>
          </div>
        </div>
      </div>

      {canUseSocialTools && <ProjectSocialPanel projectId={project.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setShowExportModal(true)} className={cardClass}>
          <Download className="h-5 w-5 text-[var(--accent)]" />
          <span className="folio-h3">Export product list</span>
          <span className="folio-body text-folio-text-secondary">Download the products tagged in your photos, organized by room, as PDF or Excel.</span>
          <span className="folio-ui underline underline-offset-4">Choose format</span>
        </button>
        <button type="button" onClick={() => setShowOverviewModal(true)} className={cardClass}>
          <FileText className="h-5 w-5 text-[var(--accent)]" />
          <span className="folio-h3">Project details</span>
          <span className="folio-body text-folio-text-secondary">View your project overview, location, and dates.</span>
          <span className="folio-ui underline underline-offset-4">View details</span>
        </button>
      </div>
      <ExportSpecModal open={showExportModal} onClose={() => setShowExportModal(false)} projectId={project.id} onExport={handleExport} />
      <OverviewModal open={showOverviewModal} onClose={() => setShowOverviewModal(false)} project={project} />
      <ConfirmDialog open={showEditDialog} title="Return this project to a draft?" description="Your story will leave public view while you edit. Your photos, story, and selections are kept. Publish again when your changes are ready." confirmText="Unpublish and edit" onConfirm={openDraft} onCancel={() => setShowEditDialog(false)} />
    </section>
  );
}
