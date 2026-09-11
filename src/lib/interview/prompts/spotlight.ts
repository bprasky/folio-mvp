import { FOLIO_INTERVIEWER_PERSONA } from './persona';
import { SHARED_RULE_BLOCK } from './rules';
import { validateInterviewQuestion } from './validateQuestion';

export const SPOTLIGHT_POLICY = 'private-spotlight-v1';
export const SPOTLIGHT_PROMPT = `${FOLIO_INTERVIEWER_PERSONA}\n${SHARED_RULE_BLOCK}\nAsk only about the server-selected piece in its confirmed room. A voluntary mention does not select another piece.`;

// This milestone uses vetted templates, not model-proposed product targets. A
// candidate can vary only by choosing an approved wording for this exact target.
export function spotlightWording(product: string, room: string, followUp = false): string {
  const label = (v: string) => v.replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 120);
  const safe = followUp
    ? `What else would you like to add about choosing ${label(product)} for ${label(room)}?`
    : `Why did you choose ${label(product)} for ${label(room)}?`;
  // Product names are data; they cannot change the target or the question kind.
  void SPOTLIGHT_PROMPT;
  return validateInterviewQuestion(safe).ok ? safe : followUp
    ? 'What else would you like to add about choosing this selected piece for its confirmed room?'
    : 'Why did you choose this selected piece for its confirmed room?';
}
