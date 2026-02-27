import { formatRoomName } from '@/lib/utils/formatRoomName';

/**
 * textHelpers.ts - Strong fallback text generators
 * 
 * Ensures text blocks NEVER render empty.
 * Provides fallbacks for project intro, room blurbs, and image captions.
 */

interface Project {
  description?: string | null;
  title?: string;
}

interface Room {
  name: string;
  description?: string | null;
  notes?: string | null;
  type?: string | null;
}

interface Image {
  name?: string | null;
  room?: string | null;
}

/**
 * Get project introduction text with strong fallback
 */
export function getProjectIntroText(project: Project): string {
  if (project.description && project.description.trim().length > 0) {
    return project.description;
  }
  
  return "A curated look at the project's approach to space, light, and materiality.";
}

/**
 * Get room blurb text with strong fallback
 */
export function getRoomBlurb(room: Room | null | undefined, project: Project): string {
  if (room) {
    // Prefer room description or notes
    if (room.description && room.description.trim().length > 0) {
      return room.description;
    }
    if (room.notes && room.notes.trim().length > 0) {
      return room.notes;
    }
    
    // Fallback template using room name
    const roomDisplay = formatRoomName(room.name || 'This space');
    return `The ${roomDisplay} showcases a thoughtful approach to space and materiality. Each element has been carefully selected to create harmony between form and function.`;
  }
  
  // Ultimate fallback
  return getProjectIntroText(project);
}

/**
 * Get image caption with strong fallback
 */
export function getImageCaption(image: Image, roomName: string | null | undefined): string {
  if (image.name && image.name.trim().length > 0) {
    return image.name;
  }
  
  if (roomName) {
    return `${formatRoomName(roomName)} — Featured moment`;
  }
  
  return 'Featured moment';
}

/**
 * Generate editorial text for split blocks with strong fallback
 * 
 * NOTE: For published posts, this should NOT be used - use editorial draft instead.
 * This is only for edit mode or fallback scenarios.
 */
export function generateEditorialText(
  roomName: string | undefined | null,
  projectDescription: string | undefined | null,
  room?: Room | null,
  mode?: 'published' | 'edit'
): string {
  // In published mode, avoid placeholder templates - prefer project description
  const isPublished = mode === 'published';
  
  // If we have room data, use room blurb
  if (room) {
    const blurb = getRoomBlurb(room, { description: projectDescription || null });
    if (blurb && blurb.trim().length > 0) {
      return blurb;
    }
  }
  
  // Use project description if available (preferred over template)
  if (projectDescription && projectDescription.trim().length > 0) {
    return projectDescription;
  }
  
  // If we have room name but no room data, use template (only for edit mode)
  if (roomName && !isPublished) {
    return `The ${formatRoomName(roomName)} showcases a thoughtful approach to space and materiality. Each element has been carefully selected to create harmony between form and function.`;
  }
  
  // Ultimate fallback (avoid template in published mode)
  if (isPublished) {
    return 'A thoughtfully designed space.';
  }
  
  return 'A carefully curated space that balances form and function.';
}






