'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { FaCloudUploadAlt, FaFileImport, FaGlobe, FaDoorOpen, FaImage, FaFileAlt, FaCalendarAlt, FaArrowLeft } from 'react-icons/fa';
import OverviewModal from './OverviewModal';
import ProjectCreationModal from '@/components/ProjectCreationModal';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';
import { PdfSpecImportModal } from '@/components/import/PdfSpecImportModal';

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
}

export default function ProjectEmptyState({ project }: ProjectEmptyStateProps) {
  const router = useRouter();
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPresentationImport, setShowPresentationImport] = useState(false);
  const [showPdfSpecImport, setShowPdfSpecImport] = useState(false);
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

  const handleAddRoom = useCallback(() => {
    // Navigate to designer board view which allows room creation
    router.push(`/project/${project.id}?view=boards`);
  }, [project.id, router]);

  const handlePublish = useCallback(() => {
    // Navigate to media section for publishing workflow
    router.push(`/project/${project.id}?view=media`);
  }, [project.id, router]);

  // Format status for display
  const formatStatus = (status: string | null | undefined) => {
    if (!status) return 'Draft';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-base)]">
        {/* Back Navigation */}
        <div className="p-4 bg-[var(--bg-elevated)] border-b border-[var(--ridge-outer)]">
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
        <header className="border-b border-[var(--ridge-outer)] bg-[var(--bg-base)]">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Project Name - Serif Italic */}
              <h1 className="font-serif italic text-2xl text-[var(--text-primary)] tracking-tight">
                {project.title}
              </h1>

              {/* Metadata Inline */}
              <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
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
              className="inline-flex items-center justify-center rounded-full bg-[var(--bg-base)] hover:bg-[var(--bg-elevated)] border border-[var(--ridge-outer)] shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              aria-label="Project overview menu"
            >
              <HiOutlineDotsHorizontal className="h-5 w-5 text-[var(--text-primary)]" />
            </button>
          </div>
        </header>

        {/* Main Content - Optical center positioning (content pushed up) */}
        <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
          {/* Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-12 text-center
              min-h-[300px] flex flex-col items-center justify-center
              transition-all duration-200 ease-out cursor-pointer
              ${isDragOver
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.02]'
                : 'border-[var(--ridge-outer)] hover:border-[var(--text-tertiary)] bg-[var(--bg-elevated)]'
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

            <div className="pointer-events-none">
              <FaCloudUploadAlt
                className={`
                  w-16 h-16 mx-auto mb-4 transition-colors duration-200
                  ${isDragOver ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
                `}
              />
              <p className="text-lg text-[var(--text-primary)] mb-2">
                {isDragOver ? 'Drop files here' : 'Drag files here to upload'}
              </p>
              <p className="folio-meta">
                Photos, presentations, or schedules
              </p>
            </div>
          </div>

          {/* CTAs */}
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

            {/* Secondary CTA - Publish Project */}
            <button
              onClick={handlePublish}
              className="ridge-btn px-6 py-3 flex items-center gap-2"
            >
              <FaGlobe className="w-4 h-4" />
              Publish Project
            </button>

            {/* Tertiary CTA - Add Room */}
            <button
              onClick={handleAddRoom}
              className="px-6 py-3 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors folio-ui flex items-center gap-2"
            >
              <FaDoorOpen className="w-4 h-4" />
              Add Room
            </button>
          </div>

          {/* Helper Cards */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Photos Card */}
            <div className="ridge-card ridge-card-sm p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--bg-elevated)]">
                  <FaImage className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="folio-ui text-[var(--text-primary)] mb-1">Photos</h3>
                  <p className="folio-meta leading-relaxed">
                    Upload project images to create a visual story and publish to your portfolio.
                  </p>
                </div>
              </div>
            </div>

            {/* Presentations Card */}
            <div className="ridge-card ridge-card-sm p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--bg-elevated)]">
                  <FaFileAlt className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="folio-ui text-[var(--text-primary)] mb-1">Presentations</h3>
                  <p className="folio-meta leading-relaxed">
                    Import decks to automatically extract rooms, products, and selections.
                  </p>
                </div>
              </div>
            </div>

            {/* Schedules Card */}
            <div className="ridge-card ridge-card-sm p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[var(--bg-elevated)]">
                  <FaCalendarAlt className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="folio-ui text-[var(--text-primary)] mb-1">Schedules</h3>
                  <p className="folio-meta leading-relaxed">
                    Upload finish schedules to populate your spec library with product data.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
    </>
  );
}
