import type { GuidedQuestion } from '@/lib/interview/guided/types';
import { PROPERTY_SALE_OPENING } from './schema';

/** Replace one existing obligation, preserving its identity and the total budget. */
export function withPropertySaleOpening(questions: GuidedQuestion[], currentlyForSale: boolean): GuidedQuestion[] {
  if (!currentlyForSale) return questions;
  const signature = questions.find(question => question.category === 'SIGNATURE_IDENTITY' && question.roomId === null && question.kind === 'prepared');
  if (!signature) return questions;
  const opening = { ...signature, text: PROPERTY_SALE_OPENING, baselineText: PROPERTY_SALE_OPENING,
    preparationStatus: 'validated' as const, sourceAnswerIds: [], adaptation: undefined, validationReason: undefined };
  return [opening, ...questions.filter(question => question !== signature)];
}
