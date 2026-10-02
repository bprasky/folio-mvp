import { z } from 'zod';

export const PROJECT_GUIDE_ACTIONS = ['start_interview', 'resume_interview', 'start_over', 'add_more', 'open_upload', 'open_tagging', 'none'] as const;
export const ProjectGuideActionSchema = z.enum(PROJECT_GUIDE_ACTIONS);
export type GuideAction = z.infer<typeof ProjectGuideActionSchema>;

export const ProjectGuideInputSchema = z.object({
  stage: z.enum(['upload', 'tagging', 'interview_new', 'interview_resume', 'interview_complete']),
  projectId: z.string().min(1).optional(),
  projectName: z.string().max(300).optional(),
  photoCount: z.number().int().nonnegative(),
  taggedPhotoCount: z.number().int().nonnegative(),
  unreviewedPhotoCount: z.number().int().nonnegative(),
  sortedPhotoCount: z.number().int().nonnegative(),
  answeredCount: z.number().int().nonnegative(),
  remainingQuestionCount: z.number().int().nonnegative().nullable(),
  allowedActions: z.array(ProjectGuideActionSchema).max(PROJECT_GUIDE_ACTIONS.length),
  userText: z.string().max(2000),
  recentTurns: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }).strict()).max(8).optional(),
}).strict().refine(value => value.taggedPhotoCount <= value.photoCount && value.unreviewedPhotoCount <= value.photoCount && value.sortedPhotoCount <= value.photoCount,
  'Photo counts must come from the same included-photo set.');

export type ProjectGuideInput = z.infer<typeof ProjectGuideInputSchema>;
export const ProjectGuideReplySchema = z.object({
  reply: z.string().trim().min(1).max(650),
  action: ProjectGuideActionSchema,
  detailText: z.string().min(1).max(2000).optional(),
}).strict();
export type ProjectGuideReply = z.infer<typeof ProjectGuideReplySchema>;
