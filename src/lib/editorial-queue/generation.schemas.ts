import { z } from 'zod';

export const AngleResponseSchema = z.object({
  angles: z.array(z.object({
    angleType: z.string(), summary: z.string(),
    signalIds: z.array(z.string()).default([]),
    confidence: z.number().finite().default(0.5),
  })),
});

export const PromptResponseSchema = z.object({
  headline: z.string().trim().min(8).max(100).regex(/\?$/)
    .refine(value => value.split(/\s+/).length <= 12).optional(),
  intro: z.string().optional(),
  items: z.array(z.object({
    prompt: z.string(), hint: z.string().optional(),
    optionA: z.string().optional(), optionB: z.string().optional(),
  })),
});

export const FORMAT_COUNTS = {
  QA: [3, 5], THIS_OR_THAT: [3, 4], GET_TO_KNOW: [4, 6],
  MATERIAL_STUDY: [3, 4], METHOD: [3, 4], DESIGNER_PROFILE: [4, 5],
} as const;
