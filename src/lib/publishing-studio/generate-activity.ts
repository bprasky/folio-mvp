import 'server-only';
import { generateSocialText } from '@/lib/instagram-export/generation';
import { activityQuestionInput, parseActivityQuestions } from './activity-questions';
import type { ActivityBrief, ActivityContext } from './activities';

/** Explicit start only. Save the resulting questions once; resuming must not regenerate them. */
export async function generateActivity(brief: ActivityBrief, context: ActivityContext) {
  const input = activityQuestionInput(brief, context);
  const raw = await generateSocialText(input.prompt, brief.format === 'twenty_questions' ? 4500 : 1800);
  return parseActivityQuestions(raw, input);
}
