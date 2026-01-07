/**
 * FOLIO DESIGN SYSTEM - GLASS COMPONENTS
 * 
 * Usage Guidelines:
 * 
 * GlassCard - Use for any container/panel/card
 *   - variant="subtle" for nested cards, backgrounds
 *   - variant="default" for standard cards
 *   - variant="strong" for hero cards, modals
 *   - variant="solid" for forms, dense content
 * 
 * EditorialHeadline - Use for ALL headlines/titles
 *   - Always use italic (default) unless there's a specific reason not to
 *   - size="lg" or "xl" for page titles
 *   - size="md" for section headers
 *   - size="sm" for card titles
 * 
 * GlassInput/GlassTextarea - Use for ALL form inputs
 *   - Replaces standard <input> and <textarea>
 *   - Pass error={true} for validation states
 * 
 * GlassButton - Use for ALL buttons
 *   - variant="primary" for main actions
 *   - variant="secondary" for secondary actions
 *   - variant="ghost" for tertiary/subtle actions
 *   - rounded="full" (default) for most cases
 * 
 * GlassBadge - Use for status indicators, tags, labels
 * 
 * GlassDivider - Use instead of <hr> or border-based dividers
 * 
 * PageContainer - Wrap page content for consistent max-width and padding
 */

// Central export for all glass components
export { GlassCard } from "./glass-card";
export type { GlassCardProps } from "./glass-card";

export { GlassModal, GlassModalHeader, GlassModalBody, GlassModalFooter } from "./glass-modal";

export { EditorialHeadline } from "./editorial-headline";
export type { EditorialHeadlineProps } from "./editorial-headline";

export { GlassInput } from "./glass-input";
export type { GlassInputProps } from "./glass-input";

export { GlassTextarea } from "./glass-textarea";
export type { GlassTextareaProps } from "./glass-textarea";

export { GlassButton } from "./glass-button";
export type { GlassButtonProps } from "./glass-button";

export { GlassBadge } from "./glass-badge";
export type { GlassBadgeProps } from "./glass-badge";

export { GlassDivider } from "./glass-divider";

export { PageContainer } from "./page-container";

