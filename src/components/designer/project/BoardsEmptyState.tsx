'use client';

import { useState } from 'react';
import { FileText, Presentation, Table2, Plus } from 'lucide-react';
import { UploadContractCard } from './UploadContractCard';
import { PresentationImportModal } from '@/components/import/PresentationImportModal';

interface BoardsEmptyStateProps {
  projectId: string;
  projectName: string;
  onCreateRoom?: () => void;
  onFloorPlanUpload?: (file: File) => void;
  onPresentationUpload?: (file: File) => void;
  onScheduleUpload?: (file: File) => void;
}

export function BoardsEmptyState({
  projectId,
  projectName,
  onCreateRoom,
  onFloorPlanUpload,
  onPresentationUpload,
  onScheduleUpload,
}: BoardsEmptyStateProps) {
  const [showPresentationImport, setShowPresentationImport] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleFloorPlanUpload = (file: File) => {
    if (onFloorPlanUpload) {
      onFloorPlanUpload(file);
    } else {
      // Default: Open presentation import modal for floor plan PDFs
      setPendingFiles([file]);
      setShowPresentationImport(true);
    }
  };

  const handlePresentationUpload = (file: File) => {
    if (onPresentationUpload) {
      onPresentationUpload(file);
    } else {
      // Default: Open presentation import modal
      setPendingFiles([file]);
      setShowPresentationImport(true);
    }
  };

  const handleScheduleUpload = (file: File) => {
    if (onScheduleUpload) {
      onScheduleUpload(file);
    } else {
      // TODO: Implement schedule import
      console.log('Schedule upload:', file.name);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-light text-[var(--text-primary)] mb-2">
          {projectName}
        </h2>
        <p className="text-[var(--text-tertiary)]">No rooms yet</p>
      </div>

      <div className="space-y-4">
        <p className="text-center text-[var(--text-secondary)] mb-6">
          Get started by uploading project files:
        </p>

        {/* Floor Plan Card */}
        <UploadContractCard
          icon={<FileText className="w-8 h-8" />}
          title="Floor Plan"
          weExtract={[
            'Room names and relationships',
            'Spatial scope of your project',
          ]}
          youGet={[
            'Auto-generated room structure',
            'AI that understands your project layout',
            'Skeleton items distributed to each room',
          ]}
          accepts=".pdf, .png, .jpg"
          onUpload={handleFloorPlanUpload}
        />

        {/* Concept Presentation Card */}
        <UploadContractCard
          icon={<Presentation className="w-8 h-8" />}
          title="Concept Presentation"
          weExtract={[
            'Products you\'re specifying → Selections',
            'Products you aspire to → Wish List',
            'Mood references → Visual library',
          ]}
          youGet={[
            'Taste fingerprint for client matching',
            'Searchable placeholders for aspirational items',
            'Organized mood board from ambience images',
          ]}
          accepts=".pdf, .pptx, .key"
          onUpload={handlePresentationUpload}
        />

        {/* Material Schedule Card */}
        <UploadContractCard
          icon={<Table2 className="w-8 h-8" />}
          title="Material Schedule"
          weExtract={[
            'Full product specifications',
            'Vendor, SKU, pricing, quantities',
          ]}
          youGet={[
            'Complete vendor attribution',
            'Folio Credit on matched products',
            'Skeletons filled with real selections',
          ]}
          accepts=".xlsx, .csv"
          onUpload={handleScheduleUpload}
        />

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border-default)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-[var(--bg-base)] text-sm text-[var(--text-tertiary)]">or</span>
          </div>
        </div>

        {/* Manual room creation */}
        <button
          onClick={onCreateRoom}
          className="w-full py-3 border border-dashed border-[var(--border-default)] rounded-lg text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Room Manually
        </button>
      </div>

      {/* Presentation Import Modal */}
      <PresentationImportModal
        open={showPresentationImport}
        onOpenChange={(open) => {
          setShowPresentationImport(open);
          if (!open) {
            setPendingFiles([]);
          }
        }}
        projectId={projectId}
        projectTitle={projectName}
        initialFiles={pendingFiles.length > 0 ? pendingFiles : undefined}
        onComplete={() => {
          // Refresh will happen automatically via router
        }}
      />
    </div>
  );
}
