import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FOR } from '@/lib/ai/models';

const anthropic = new Anthropic();

// --- Org profile extraction ---

export interface ExtractedOrgFields {
  description: string | null;
  tagline: string | null;
  philosophy: string | null;
  foundingYear: number | null;
  teamSize: string | null;
  specialties: string[] | null;
  city: string | null;
  primaryMarket: string | null;
  travelsForWork: boolean | null;
  additionalMarkets: string[] | null;
  processDescription: string | null;
}

const ORG_FIELD_SCHEMA = {
  description: 'string | null — Main About paragraph (2-4 sentences, third person)',
  tagline: 'string | null — One-liner that sounds like the designer said it',
  philosophy: 'string | null — Design philosophy, close to their actual words',
  foundingYear: 'number | null — Only if explicitly stated',
  teamSize: 'string | null — e.g. "boutique, 4 people"',
  specialties: 'string[] | null — Only if explicitly mentioned, max 6',
  city: 'string | null — e.g. "Miami, FL"',
  primaryMarket: 'string | null — e.g. "South Florida"',
  travelsForWork: 'boolean | null — Explicit yes/no from answer',
  additionalMarkets: 'string[] | null — e.g. ["New York", "The Hamptons"]',
  processDescription: 'string | null — How they approach projects',
};

export async function extractOrgProfileFields(transcript: string): Promise<ExtractedOrgFields> {
  const response = await anthropic.messages.create({
    model: MODEL_FOR.extraction,
    thinking: { type: 'disabled' },
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are extracting structured profile fields from a designer's About interview transcript.
Extract only what is clearly stated or strongly implied.

Return null for any field you cannot confidently extract — do not guess or infer.
Return only valid JSON. No preamble, no markdown.

TRANSCRIPT:
${transcript}

EXTRACT THE FOLLOWING FIELDS:
${JSON.stringify(ORG_FIELD_SCHEMA, null, 2)}

RULES:
- description: 2–4 sentences in third person. Lead with something specific, not generic.
  GOOD: "Sarah Chen founded her studio after a decade restoring historic homes..."
  BAD: "Sarah is a passionate designer dedicated to beautiful spaces..."
- tagline: One line. Should sound like the designer said it, not like marketing copy.
- specialties: Only include if explicitly mentioned. Max 6 items.
- Do not hallucinate press mentions, awards, or client names.
- foundingYear: Only if explicitly stated. Return as number, not string.
- philosophy: Extract verbatim-ish — stay close to their actual words.`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as ExtractedOrgFields;
}

// --- Personal profile extraction ---

export interface ExtractedPersonalFields {
  bio: string | null;
  title: string | null;
  location: string | null;
  studio: string | null;
  specialties: string[] | null;
  designPhilosophy: string | null;
}

const PERSONAL_FIELD_SCHEMA = {
  bio: 'string | null — 2-4 sentences, third person, specific and warm',
  title: 'string | null — Professional title, e.g. "Principal Designer"',
  location: 'string | null — City, State',
  studio: 'string | null — Studio or firm name if mentioned',
  specialties: 'string[] | null — Design specialties, max 6',
  designPhilosophy: 'string | null — Philosophy statement, close to their words',
};

export async function extractPersonalProfileFields(transcript: string): Promise<ExtractedPersonalFields> {
  const response = await anthropic.messages.create({
    model: MODEL_FOR.extraction,
    thinking: { type: 'disabled' },
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are extracting structured profile fields from a designer's personal About interview transcript.
Extract only what is clearly stated or strongly implied.

Return null for any field you cannot confidently extract — do not guess or infer.
Return only valid JSON. No preamble, no markdown.

TRANSCRIPT:
${transcript}

EXTRACT THE FOLLOWING FIELDS:
${JSON.stringify(PERSONAL_FIELD_SCHEMA, null, 2)}

RULES:
- bio: 2–4 sentences in third person. Lead with something specific.
- specialties: Only include if explicitly mentioned. Max 6 items.
- Do not hallucinate press mentions, awards, or client names.
- designPhilosophy: Stay close to their actual words.`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned) as ExtractedPersonalFields;
}
