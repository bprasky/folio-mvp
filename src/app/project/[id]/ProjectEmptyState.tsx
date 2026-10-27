'use client';
import { createRoom as createRoomWithRetry } from '@/lib/client/createRoom';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { FaCloudUploadAlt, FaFileImport, FaDoorOpen, FaCalendarAlt, FaArrowLeft, FaGlobe } from 'react-icons/fa';
import OverviewModal from './OverviewModal';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';
import { PdfSpecImportModal } from '@/components/import/PdfSpecImportModal';
import { WebsiteImportModal } from '@/components/import/WebsiteImportModal';

interface Project {
  id: string;
  title: string;
  category?: string | null;
  status?: string | null;
  stage: string;
  projectType: string;
  clientType: string;
  budgetBand: string;
  city?: string | null;
  regionState?: string | null;
  description?: string | null;
  isPublic: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectEmptyStateProps {
  project: Project;
  /** Pro flag (canUsePortfolioScrape) — gates the URL import, same as the wizard. */
  canScrape?: boolean;
}

export default function ProjectEmptyState({ project, canScrape = false }: ProjectEmptyStateProps) {
  const router = useRouter();
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPresentationImport, setShowPresentationImport] = useState(false);
  const [showPdfSpecImport, setShowPdfSpecImport] = useState(false);
  const [showWebsiteImport, setShowWebsiteImport] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; type?: string | null }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch rooms for PDF spec import
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await fetch(`/api/projects/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setRooms(data.rooms || []);
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    }
    fetchRooms();
  }, [project.id]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Check if any files are presentations (PDF or PPTX)
      const hasPresentationFile = files.some(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.pdf') || name.endsWith('.pptx');
      });

      if (hasPresentationFile) {
        // Use the AI-powered presentation import for PDF/PPTX
        const presentationFiles = files.filter(file => {
          const name = file.name.toLowerCase();
          return name.endsWith('.pdf') || name.endsWith('.pptx');
        });
        setPendingFiles(presentationFiles);
        setShowPresentationImport(true);
      } else {
        // Use the regular upload modal for images
        setShowUploadModal(true);
        // Store file info for legacy modal
        const fileData = files.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        }));
        sessionStorage.setItem('pendingUploadFiles', JSON.stringify(fileData));
      }
    }
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Check if any files are presentations (PDF or PPTX)
      const hasPresentationFile = files.some(file => {
        const name = file.name.toLowerCase();
        return name.endsWith('.pdf') || name.endsWith('.pptx');
      });

      if (hasPresentationFile) {
        // Use the AI-powered presentation import for PDF/PPTX
        const presentationFiles = files.filter(file => {
          const name = file.name.toLowerCase();
          return name.endsWith('.pdf') || name.endsWith('.pptx');
        });
        setPendingFiles(presentationFiles);
        setShowPresentationImport(true);
      } else {
        // Use the regular upload modal for images
        setShowUploadModal(true);
      }
    }
  }, []);

  const handleImportPresentation = useCallback(() => {
    // Open file picker for presentation files
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.pptx';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (files.length > 0) {
        setPendingFiles(files);
        setShowPresentationImport(true);
      }
    };
    input.click();
  }, []);

  const handlePresentationImportComplete = useCallback((result: { roomsCreated: number; productsTagged: number }) => {
    // Refresh the page to show new rooms
    router.refresh();
  }, [router]);

  const handleImportPdfSpecs = useCallback(() => {
    // Open file picker for PDF spec files
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
        setPendingFiles(files);
        setShowPdfSpecImport(true);
      }
    };
    input.click();
  }, []);

  const handlePdfSpecImportComplete = useCallback(() => {
    // Refresh the page to show new items
    router.refresh();
  }, [router]);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const handleAddRoom = useCallback(async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);

    try {
      await createRoomWithRetry({ projectId: project.id, name: 'New Room' });

      // Refresh to show the new room
      router.refresh();
    } catch (error) {
      console.error('Failed to create room:', error);
      alert(error instanceof Error ? error.message : 'Could not create room. Retry to check.');
    } finally {
      setIsCreatingRoom(false);
    }
  }, [project.id, router, isCreatingRoom]);

  // Determine if this is a new/draft project (starting from scratch)
  // vs a completed project (importing existing work)
  const isDraftProject = !project.status || project.status === 'draft';

  // Format status for display
  const formatStatus = (status: string | null | undefined) => {
    if (!status) return 'Draft';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  return (
    <>
      <div className="min-h-screen bg-surface-canvas">
        {/* Back Navigation */}
        <div className="p-4 bg-surface-ground border-b border-folio-border-subtle">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/projects"
              className="inline-flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors folio-ui"
            >
              <FaArrowLeft className="mr-2 w-3 h-3" /> Back to Projects
            </Link>
          </div>
        </div>

        {/* Collapsed Header - Single Line */}
        <header className="border-b border-folio-border-subtle bg-surface-canvas">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Project Name - Serif Italic */}
              <h1 className="font-serif italic text-2xl text-folio-text-primary tracking-tight">
                {project.title}
              </h1>

              {/* Metadata Inline */}
              <div className="flex items-center gap-3 text-folio-text-tertiary">
                <span className="folio-meta">
                  {project.category || 'Uncategorized'}
                </span>
                <span className="text-[var(--ridge-outer)]">|</span>
                <span className="folio-meta">
                  {formatStatus(project.status)}
                </span>
              </div>
            </div>

            {/* Overview Menu Button */}
            <button
              onClick={() => setShowOverviewModal(true)}
              className="inline-flex items-center justify-center rounded-full bg-surface-canvas hover:bg-surface-ground border border-folio-border-subtle shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              aria-label="Project overview menu"
            >
              <HiOutlineDotsHorizontal className="h-5 w-5 text-folio-text-primary" />
            </button>
          </div>
        </header>

        {/* Main Content - Optical center positioning (content pushed up) */}
        <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
          {/* CTAs - Different layout based on project status */}
          {isDraftProject ? (
            <>
              {/* NEW PROJECT FLOW - Primary CTA first */}
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <p className="folio-meta text-folio-text-secondary mb-4">
                    Start building your project from the ground up
                  </p>
                  {/* Primary CTA - Add Room */}
                  <button
                    onClick={handleAddRoom}
                    disabled={isCreatingRoom}
                    className="accent-btn px-6 py-3 flex items-center gap-2.5 mx-auto"
                  >
                    <FaDoorOpen className="w-4 h-4" />
                    {isCreatingRoom ? 'Creating...' : 'Add Your First Room'}
                  </button>
                </div>

                {/* Divider */}
                <div className="w-full max-w-md flex items-center gap-4">
                  <div className="flex-1 border-t border-folio-border-subtle" />
                  <span className="folio-meta text-folio-text-tertiary">or add files</span>
                  <div className="flex-1 border-t border-folio-border-subtle" />
                </div>

                {/* Drop Zone - Compact */}
                <div
                  ref={dropZoneRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`
                    relative w-full border-2 border-dashed rounded-xl py-8 px-6 text-center
                    flex flex-col items-center justify-center
                    transition-all duration-200 ease-out cursor-pointer
                    ${isDragOver
                      ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]'
                      : 'border-folio-border-subtle hover:border-folio-text-tertiary bg-surface-ground'
                    }
                  `}
                  onClick={() => setShowUploadModal(true)}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.pptx,.ppt,.key,.xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="pointer-events-none flex items-center gap-4">
                    <FaCloudUploadAlt
                      className={`
                        w-8 h-8 flex-shrink-0 transition-colors duration-200
                        ${isDragOver ? 'text-[var(--accent)]' : 'text-folio-text-tertiary'}
                      `}
                    />
                    <div className="text-left">
                      <p className="text-folio-text-primary folio-ui">
                        {isDragOver ? 'Drop files here' : 'Drag files here to upload'}
                      </p>
                      <p className="folio-meta">
                        Photos, presentations, or schedules
                      </p>
                    </div>
                  </div>
                </div>

                {/* Secondary options - Import */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleImportPresentation}
                    className="ridge-btn px-5 py-2.5 flex items-center gap-2"
                  >
                    <FaFileImport className="w-4 h-4" />
                    Import Presentation
                  </button>
                  <button
                    onClick={handleImportPdfSpecs}
                    className="ridge-btn px-5 py-2.5 flex items-center gap-2"
                    title="Extract product specs from PDF (brand, price, dimensions)"
                  >
                    <FaCalendarAlt className="w-4 h-4" />
                    Import PDF Specs
                  </button>
                  {canScrape && (
                    <button
                      onClick={() => setShowWebsiteImport(true)}
                      className="ridge-btn px-5 py-2.5 flex items-center gap-2"
                      title="Pull photos from a project or portfolio URL"
                    >
                      <FaGlobe className="w-4 h-4" />
                      Import from URL
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* COMPLETED PROJECT FLOW - Emphasize importing/publishing */}
              {/* Drop Zone - Compact */}
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                  relative w-full border-2 border-dashed rounded-xl py-8 px-6 text-center
                  flex flex-col items-center justify-center
                  transition-all duration-200 ease-out cursor-pointer
                  ${isDragOver
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]'
                    : 'border-folio-border-subtle hover:border-folio-text-tertiary bg-surface-ground'
                  }
                `}
                onClick={() => setShowUploadModal(true)}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.pptx,.ppt,.key,.xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="pointer-events-none flex items-center gap-4">
                  <FaCloudUploadAlt
                    className={`
                      w-8 h-8 flex-shrink-0 transition-colors duration-200
                      ${isDragOver ? 'text-[var(--accent)]' : 'text-folio-text-tertiary'}
                    `}
                  />
                  <div className="text-left">
                    <p className="text-folio-text-primary folio-ui">
                      {isDragOver ? 'Drop files here' : 'Drag files here to upload'}
                    </p>
                    <p className="folio-meta">
                      Photos, presentations, or schedules
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
                {/* Primary CTA - Import Presentation */}
                <button
                  onClick={handleImportPresentation}
                  className="accent-btn px-6 py-3 flex items-center gap-2"
                >
                  <FaFileImport className="w-4 h-4" />
                  Import Presentation
                </button>

                {/* PDF Spec Import */}
                <button
                  onClick={handleImportPdfSpecs}
                  className="ridge-btn px-6 py-3 flex items-center gap-2"
                  title="Extract product specs from PDF (brand, price, dimensions)"
                >
                  <FaCalendarAlt className="w-4 h-4" />
                  Import PDF Specs
                </button>

                {canScrape && (
                  <button
                    onClick={() => setShowWebsiteImport(true)}
                    className="ridge-btn px-6 py-3 flex items-center gap-2"
                    title="Pull photos from a project or portfolio URL"
                  >
                    <FaGlobe className="w-4 h-4" />
                    Import from URL
                  </button>
                )}
              </div>

              {/* Add Room as tertiary option */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleAddRoom}
                  disabled={isCreatingRoom}
                  className="px-6 py-3 text-folio-text-secondary hover:text-[var(--accent)] transition-colors folio-ui flex items-center gap-2 mx-auto"
                >
                  <FaDoorOpen className="w-4 h-4" />
                  {isCreatingRoom ? 'Creating...' : 'Add Room'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Overview Modal */}
      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />

      {/* Upload Modal (for images) */}
      {showUploadModal && (
        <ProjectCreationModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            sessionStorage.removeItem('pendingUploadFiles');
          }}
          onProjectCreated={() => {
            setShowUploadModal(false);
            sessionStorage.removeItem('pendingUploadFiles');
            router.refresh();
          }}
          editingProject={project}
        />
      )}

      {/* Presentation Import Modal (for PDF/PPTX with AI processing) */}
      <PresentationImportModal
        open={showPresentationImport}
        onOpenChange={(open) => {
          setShowPresentationImport(open);
          if (!open) {
            setPendingFiles([]);
          }
        }}
        projectId={project.id}
        projectTitle={project.title}
        initialFiles={pendingFiles.length > 0 ? pendingFiles : undefined}
        onComplete={handlePresentationImportComplete}
      />

      {/* PDF Spec Import Modal (for extracting text specs from PDFs) */}
      <PdfSpecImportModal
        open={showPdfSpecImport}
        onOpenChange={(open) => {
          setShowPdfSpecImport(open);
          if (!open) {
            setPendingFiles([]);
          }
        }}
        projectId={project.id}
        projectTitle={project.title}
        rooms={rooms}
        initialFile={pendingFiles.length > 0 ? pendingFiles[0] : undefined}
        onComplete={handlePdfSpecImportComplete}
      />

      <WebsiteImportModal
        open={showWebsiteImport}
        onOpenChange={setShowWebsiteImport}
        projectId={project.id}
        onComplete={() => router.refresh()}
      />
    </>
  );
}
