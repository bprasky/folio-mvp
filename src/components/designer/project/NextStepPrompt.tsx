'use client';

import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';

interface ProjectState {
  hasFloorPlan: boolean;
  hasPresentation: boolean;
  hasMaterialSchedule: boolean;
  hasPhotography: boolean;
  roomCount: number;
  selectionCount: number;
  skeletonCount: number;
  unmatchedSkeletonCount: number;
  hasEditorialDraft: boolean;
  isPublished: boolean;
}

interface NextStep {
  message: string;
  action: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function getNextStep(
  state: ProjectState,
  actions: {
    openFloorPlanUpload: () => void;
    openCreateRoom: () => void;
    openPresentationUpload: () => void;
    openScheduleUpload: () => void;
    openPhotoUpload: () => void;
    switchToPublishTab: () => void;
    filterToSkeletons: () => void;
  }
): NextStep | null {
  // Priority 1: No rooms - need floor plan or manual creation
  if (state.roomCount === 0) {
    return {
      message: 'Upload a floor plan to auto-generate rooms, or create rooms manually.',
      action: { label: 'Upload Plan', onClick: actions.openFloorPlanUpload },
      secondaryAction: { label: 'Create Room', onClick: actions.openCreateRoom },
    };
  }

  // Priority 2: Rooms but no selections - need presentation
  if (state.roomCount > 0 && state.selectionCount === 0 && !state.hasPresentation) {
    return {
      message: 'Upload a concept presentation to populate rooms with selections and aspirational items.',
      action: { label: 'Upload Presentation', onClick: actions.openPresentationUpload },
    };
  }

  // Priority 3: Has skeletons but no schedule - can match or upload schedule
  if (state.unmatchedSkeletonCount > 0 && !state.hasMaterialSchedule) {
    return {
      message: `${state.unmatchedSkeletonCount} items need matching. Upload a material schedule or search Folio for products.`,
      action: { label: 'Upload Schedule', onClick: actions.openScheduleUpload },
      secondaryAction: { label: 'View Unmatched', onClick: actions.filterToSkeletons },
    };
  }

  // Priority 4: Has selections, no photos - ready for completion
  if (state.selectionCount > 5 && !state.hasPhotography) {
    return {
      message: 'Ready to complete? Upload final photography to auto-tag products and prepare your portfolio.',
      action: { label: 'Upload Photos', onClick: actions.openPhotoUpload },
      secondaryAction: { label: 'Go to Publish', onClick: actions.switchToPublishTab },
    };
  }

  // Priority 5: Has photos, not published
  if (state.hasPhotography && !state.isPublished) {
    return {
      message: 'Your project is ready to publish. Generate an editorial and share to your portfolio.',
      action: { label: 'Go to Publish', onClick: actions.switchToPublishTab },
    };
  }

  // No prompt needed
  return null;
}

interface NextStepPromptProps {
  projectState: ProjectState;
  onOpenFloorPlanUpload: () => void;
  onOpenCreateRoom: () => void;
  onOpenPresentationUpload: () => void;
  onOpenScheduleUpload: () => void;
  onOpenPhotoUpload: () => void;
  onSwitchToPublishTab: () => void;
  onFilterToSkeletons: () => void;
}

export function NextStepPrompt({
  projectState,
  onOpenFloorPlanUpload,
  onOpenCreateRoom,
  onOpenPresentationUpload,
  onOpenScheduleUpload,
  onOpenPhotoUpload,
  onSwitchToPublishTab,
  onFilterToSkeletons,
}: NextStepPromptProps) {
  const nextStep = useMemo(() => {
    return getNextStep(projectState, {
      openFloorPlanUpload: onOpenFloorPlanUpload,
      openCreateRoom: onOpenCreateRoom,
      openPresentationUpload: onOpenPresentationUpload,
      openScheduleUpload: onOpenScheduleUpload,
      openPhotoUpload: onOpenPhotoUpload,
      switchToPublishTab: onSwitchToPublishTab,
      filterToSkeletons: onFilterToSkeletons,
    });
  }, [
    projectState,
    onOpenFloorPlanUpload,
    onOpenCreateRoom,
    onOpenPresentationUpload,
    onOpenScheduleUpload,
    onOpenPhotoUpload,
    onSwitchToPublishTab,
    onFilterToSkeletons,
  ]);

  if (!nextStep) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 px-6 py-4 z-40">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-stone-700 text-sm truncate">{nextStep.message}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {nextStep.secondaryAction && (
            <button
              onClick={nextStep.secondaryAction.onClick}
              className="px-4 py-2 text-stone-600 hover:text-stone-800 text-sm"
            >
              {nextStep.secondaryAction.label}
            </button>
          )}
          <button
            onClick={nextStep.action.onClick}
            className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 transition-colors"
          >
            {nextStep.action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper hook to compute project state from project data
export function useProjectState(project: {
  rooms?: Array<{ selections?: any[] }>;
  images?: any[];
  isPublic?: boolean;
}): ProjectState {
  return useMemo(() => {
    const rooms = project.rooms || [];
    const images = project.images || [];
    const allSelections = rooms.flatMap(r => r.selections || []);

    // Count skeletons (items without full product data)
    const skeletons = allSelections.filter((s: any) =>
      !s.vendorProductId && !s.productUrl && s.productName
    );

    return {
      hasFloorPlan: false, // TODO: Track floor plan uploads
      hasPresentation: false, // TODO: Track presentation imports
      hasMaterialSchedule: false, // TODO: Track schedule uploads
      hasPhotography: images.length > 0,
      roomCount: rooms.length,
      selectionCount: allSelections.length,
      skeletonCount: skeletons.length,
      unmatchedSkeletonCount: skeletons.length,
      hasEditorialDraft: false, // TODO: Check for draft
      isPublished: project.isPublic || false,
    };
  }, [project]);
}
