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
  // Room attribution + provenance (D5). Declared first-class so `normalizeAnswers`
  // preserves them instead of stripping them as unknown keys — the canonical
  // store (provenance.interview.payload.answers) must know which room an answer
  // belongs to, independent of eligibility. No `.passthrough()`: if a field
  // matters, it is declared.
  roomId: z.string().nullable().optional(),
  questionSource: z.string().optional(),
  isCrossRoom: z.boolean().optional(),
  inputModality: z.enum(["text", "voice", "mixed"]).optional(),
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

export type InterviewAnswer = z.infer<typeof InterviewAnswerSchema>;
export type InterviewPayload = z.infer<typeof InterviewPayloadSchema>;

/** Question shape used by interview UI components (formerly in questionBank.ts) */
export type InterviewQuestion = {
  id: string;
  role: "DESIGNER" | "VENDOR" | "ANY";
  section: "why" | "who" | "what" | "where" | "when" | "how";
  prompt: string;
  helper?: string;
  maxLen?: number;
};

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

