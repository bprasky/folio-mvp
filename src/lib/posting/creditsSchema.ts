import { z } from "zod";

/**
 * Credits Schema for ProjectPost.credits (Json field)
 *
 * Each CreditEntry represents a collaborator on a project.
 * Credits are addable both before article generation (so the AI
 * can reference collaborators) and after generation (so designers
 * can add people they forgot).
 *
 * --- Future: Super Articles (see docs/15_SUPER_ARTICLES.md) ---
 * - CreditEntry.userId will link to that person's InterviewSession for this project,
 *   allowing each credited party to contribute their own perspective editorial.
 * - Credits may gain a `contributionStatus` field: "invited" | "contributed" | "declined"
 *   to track the progressive assembly of multi-party Super-Articles.
 * - Only subscribers will be able to add their "voice" (perspective editorial),
 *   but anyone can be credited for free — creating natural subscription pressure.
 */

export const CREDIT_ROLE_OPTIONS = [
  "Designer",
  "Architect",
  "Contractor / Builder",
  "Photographer",
  "Stylist",
  "Landscape Designer",
] as const;

export const CreditEntrySchema = z.object({
  role: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
});

export const CreditsArraySchema = z.array(CreditEntrySchema);

export type CreditEntry = z.infer<typeof CreditEntrySchema>;
export type Credits = CreditEntry[];

/**
 * Validate and clean credits array from unknown input (e.g. Json field).
 * Returns only valid entries; silently drops malformed ones.
 */
export function parseCredits(raw: unknown): Credits {
  if (!Array.isArray(raw)) return [];
  const result: Credits = [];
  for (const item of raw) {
    const parsed = CreditEntrySchema.safeParse(item);
    if (parsed.success) {
      result.push(parsed.data);
    }
  }
  return result;
}
