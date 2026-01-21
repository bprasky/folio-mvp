/**
 * File upload classification utility
 *
 * Classifies uploaded files based on extension, filename hints, and context
 * to route them to the appropriate processing pipeline.
 */

export type FileClassification =
  | 'floor_plan'
  | 'concept_presentation'
  | 'progress_presentation'
  | 'material_schedule'
  | 'final_photography'
  | 'unknown';

export interface UploadContext {
  type?: FileClassification;
  projectStage?: string;
  existingFileTypes?: FileClassification[];
}

/**
 * Classify an uploaded file to determine how it should be processed
 */
export function classifyUpload(file: File, context?: UploadContext): FileClassification {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const name = file.name.toLowerCase();

  // Explicit context from upload card takes precedence
  if (context?.type) {
    return context.type;
  }

  // Spreadsheets are almost always material schedules
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
    return 'material_schedule';
  }

  // Images could be plans or photography
  if (['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext || '')) {
    // Check filename hints for floor plan
    if (
      name.includes('plan') ||
      name.includes('floor') ||
      name.includes('layout') ||
      name.includes('floorplan')
    ) {
      return 'floor_plan';
    }
    // Check filename hints for photography
    if (
      name.includes('photo') ||
      name.includes('final') ||
      name.includes('complete') ||
      name.includes('finished')
    ) {
      return 'final_photography';
    }
    // Default to photography for images
    return 'final_photography';
  }

  // PDFs and presentations need more context
  if (['pdf', 'pptx', 'ppt', 'key'].includes(ext || '')) {
    // Check filename hints for floor plan
    if (
      name.includes('plan') ||
      name.includes('floor') ||
      name.includes('layout') ||
      name.includes('floorplan')
    ) {
      return 'floor_plan';
    }

    // Check filename hints for concept presentation
    if (
      name.includes('concept') ||
      name.includes('initial') ||
      name.includes('v1') ||
      name.includes('mood') ||
      name.includes('design')
    ) {
      return 'concept_presentation';
    }

    // Check filename hints for progress presentation
    if (
      name.includes('progress') ||
      name.includes('update') ||
      name.includes('v2') ||
      name.includes('v3') ||
      name.includes('revision')
    ) {
      return 'progress_presentation';
    }

    // Check filename hints for final presentation
    if (name.includes('final') || name.includes('approved')) {
      // Final presentation still gets full extraction
      return 'concept_presentation';
    }

    // Default presentations to concept
    return 'concept_presentation';
  }

  return 'unknown';
}

/**
 * Get a human-readable label for a file classification
 */
export function getClassificationLabel(classification: FileClassification): string {
  const labels: Record<FileClassification, string> = {
    floor_plan: 'Floor Plan',
    concept_presentation: 'Concept Presentation',
    progress_presentation: 'Progress Presentation',
    material_schedule: 'Material Schedule',
    final_photography: 'Final Photography',
    unknown: 'Unknown',
  };
  return labels[classification];
}

/**
 * Get the accepted file extensions for a classification type
 */
export function getAcceptedExtensions(classification: FileClassification): string {
  const extensions: Record<FileClassification, string> = {
    floor_plan: '.pdf,.png,.jpg,.jpeg',
    concept_presentation: '.pdf,.pptx,.ppt,.key',
    progress_presentation: '.pdf,.pptx,.ppt,.key',
    material_schedule: '.xlsx,.xls,.csv',
    final_photography: '.png,.jpg,.jpeg,.webp,.heic',
    unknown: '*',
  };
  return extensions[classification];
}
