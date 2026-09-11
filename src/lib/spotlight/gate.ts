/** Server configuration only. Enrollment survives the kill switch. */
const entries = (value: string | undefined) => new Set((value || '').split(',').map(v => v.trim()).filter(Boolean));
export const spotlightEnrolled = (projectId: string) => entries(process.env.SPOTLIGHT_PROJECT_IDS).has(projectId);
export const spotlightEnabled = (projectId: string, actorId: string) =>
  process.env.SPOTLIGHT_INTERVIEW_V1 === 'true' && spotlightEnrolled(projectId) && entries(process.env.SPOTLIGHT_ACTOR_IDS).has(actorId);

export class SpotlightConflict extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
