export type ModerationResult = { flagged: boolean; fields?: string[]; reason?: string };

const BAD_WORDS = [
  // keep subtle; this is a preview gate not a ban system
  "fuck", "shit", "bitch", "asshole",
];

export function simpleProfanityCheck(text: string) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => lower.includes(w));
}

export async function moderateAnswers(answers: {questionId:string; answer:string}[]): Promise<ModerationResult> {
  const flaggedFields = answers
    .filter(a => simpleProfanityCheck(a.answer))
    .map(a => a.questionId);

  if (flaggedFields.length) {
    return { flagged: true, fields: flaggedFields, reason: "profanity" };
  }

  // Optional: OpenAI moderation (non-blocking; soft warn)
  try {
    if (!!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false") {
      const client = await import("openai").then(m => new m.default({ apiKey: process.env.OPENAI_API_KEY }));
      const sample = answers.map(a => a.answer).join("\n\n---\n\n").slice(0, 4000);
      const mod = await client.moderations.create({ model: "omni-moderation-latest", input: sample });
      const anyFlag = (Array.isArray(mod.results) ? mod.results : [mod.results]).some(r => (r as any).flagged);
      if (anyFlag) return { flagged: true, reason: "openai_moderation" };
    }
  } catch {
    // ignore moderation failure, keep UX flowing
  }

  return { flagged: false };
}


