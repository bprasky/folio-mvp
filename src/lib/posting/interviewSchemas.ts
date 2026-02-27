import { z } from "zod";

export const SECTION_ENUM = z.enum([
  // legacy
  "designIntent",
  "materialsMethod",
  "collaboration",
  "emotionalCore",
  "insightsReflection",
  "lightningRound",
  // new 6W
  "why",
  "who",
  "what",
  "where",
  "when",
  "how",
]);

export const SIX_W_ENUM = z.enum(["WHY", "WHO", "WHAT", "WHERE", "WHEN", "HOW"]);
export type SixWCategory = z.infer<typeof SIX_W_ENUM>;

const AnswerBaseSchema = z.object({
  questionId: z.string().min(1),
  role: z.enum(["DESIGNER", "VENDOR", "ANY"]).optional(),
  section: SECTION_ENUM.optional(),
  category: SIX_W_ENUM.optional(),
  isFollowUp: z.boolean().optional(),
  prompt: z.string().optional(),
  answer: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, { message: "blank" })
    .refine((s) => s.length <= 2000, { message: "too_long" }),
});

export const InterviewAnswerSchema = AnswerBaseSchema.transform((value) => ({
  ...value,
  role: value.role ?? "DESIGNER",
}));

export const InterviewPayloadSchema = z.object({
  selectedQuestionIds: z.array(z.string()).optional(),
  answers: z.array(InterviewAnswerSchema).min(1),
  imageOrder: z.array(z.string()).optional(), // Allow any string IDs, not just UUIDs
});

// Map new 6W to legacy buckets so the generator keeps weighting consistent
export const sectionAliasToLegacy: Record<string, string> = {
  why: "designIntent",
  who: "collaboration",
  what: "materialsMethod",
  where: "designIntent",
  when: "insightsReflection",
  how: "materialsMethod",
};

export type InterviewAnswer = z.infer<typeof InterviewAnswerSchema>;
export type InterviewPayload = z.infer<typeof InterviewPayloadSchema>;

const WHITESPACE_RE = /\s+/g;

export function makeAnswerKey(answer: { questionId: string; answer: string; isFollowUp?: boolean }) {
  const normalizedAnswer = answer.answer.trim().toLowerCase().replace(WHITESPACE_RE, " ");
  const followupMarker = answer.isFollowUp ? "F" : "P";
  return `${answer.questionId}|${followupMarker}|${normalizedAnswer}`;
}

export function normalizeAnswers(input: unknown): InterviewAnswer[] {
  const parsed = z.array(InterviewAnswerSchema).parse(input);
  const seen = new Map<string, InterviewAnswer>();

  for (const ans of parsed) {
    const key = makeAnswerKey(ans);
    // keep latest occurrence
    seen.set(key, ans);
  }

  return Array.from(seen.values());
}

