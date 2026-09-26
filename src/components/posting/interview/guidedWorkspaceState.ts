import type { GuidedCommand } from '@/lib/interview/guided/types';

/** Only unambiguous standalone commands are interpreted as controls. */
export function guidedTextIntent(text: string): 'skip' | 'pause' | null {
  const command = text.trim().toLowerCase().replace(/[.!]+$/, '');
  if (['skip', 'skip this', 'skip this question', 'move on', 'next question'].includes(command)) return 'skip';
  if (['pause', 'pause interview', 'pause the interview', 'save and close'].includes(command)) return 'pause';
  return null;
}

export function appendTranscript(text: string, transcript: string): string {
  return text ? `${text}\n\n${transcript}` : transcript;
}

export interface PendingPhotoTransition { imageId: string; navigationVersion: number }

/** Typing/recording holds transitions; later manual browsing cancels them. */
export function resolvePhotoTransition(pending: PendingPhotoTransition | null, navigationVersion: number, busy: boolean) {
  if (!pending || pending.navigationVersion !== navigationVersion) return { pending: null, imageId: null };
  if (busy) return { pending, imageId: null };
  return { pending: null, imageId: pending.imageId };
}

export interface GuidedLocalDraft {
  questionId: string | null;
  text: string;
  inputModality: 'text' | 'voice' | 'mixed';
  selectedImageId: string | null;
  recordingId?: string;
  correctingTurnId?: string;
  pending: GuidedCommand | null;
}

export const emptyGuidedDraft = (): GuidedLocalDraft => ({ questionId: null, text: '', inputModality: 'text', selectedImageId: null, pending: null });
