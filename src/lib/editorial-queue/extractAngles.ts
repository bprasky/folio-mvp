// Editorial Queue — angle extraction (docs/17_EDITORIAL_QUEUE.md, Component 2).
// One Anthropic call over the corpus digest: the model receives the computed
// signals (not raw project dumps) and its job narrows to ranking which signals
// carry the best editorial angle right now and writing the framing. It does not
// discover facts — the signal layer already did.
//
// The model constant comes from the centralized MODELS object; the call goes
// through the shared callLLM wrapper (retries + cost recording). Persistence is
// gated on the validation-reject rule in validateAngles.ts.

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { MODELS } from '@/lib/ai/models';
import { callLLM } from '@/lib/posting/llmClient';
import { validateAngles } from './validateAngles';
import { ANGLE_TYPES } from './types';
import type {
  AngleValidationResult,
  CandidateAngle,
  CorpusDigest,
  ExtractedAngle,
} from './types';

const ANGLE_EXTRACTION_MAX_TOKENS = 1500;
const ANGLE_EXTRACTION_TEMPERATURE = 0.4;
// Cap how many signals we hand the model — the digest is already strength-sorted,
// so this keeps the prompt bounded on mature corpora without dropping the
// strongest material.
const MAX_SIGNALS_IN_PROMPT = 40;

const SYSTEM_PROMPT = `You are Folio's editorial director reading one interior designer's body of work. Your job is NOT to discover facts about their work — a deterministic system has already computed the facts and handed them to you as SIGNALS. Your job is to decide which signals carry the best magazine story right now, and to write the editorial framing.

You will receive a list of computed SIGNALS, each with a stable id, a type, a headline, and a strength. You will also receive light context (the designer's positioning and their published project titles) and any angles already used, so you don't repeat yourself.

Return candidate editorial angles. For each angle:
- Pick an angleType from exactly this set: ${ANGLE_TYPES.join(', ')}.
- Write a one-line editorial summary: the story this angle tells, in an editor's voice. Specific to THIS designer — a line that could only be written about this corpus.
- Cite the signal ids that support the angle in signalIds.

HARD RULE — this is non-negotiable and your output is discarded if you break it:
- signalIds may contain ONLY ids that appear in the SIGNALS list you were given. Never invent an id, never modify one, never cite a signal that isn't listed. If you cannot support an angle with a real signal id, do not return that angle.

Prefer fewer, stronger angles over many weak ones. Rank by editorial strength: return the best first.

Return ONLY a JSON object, no prose, no markdown fences:
{"angles": [{"angleType": "...", "summary": "...", "signalIds": ["..."], "confidence": 0.0}]}
confidence is your 0..1 read of how strong the angle is.`;

// Assemble the user-facing prompt from the digest. Pure — testable without an
// API call, and the signal ids it emits are exactly what the guard validates.
export function buildAngleUserPrompt(digest: CorpusDigest): string {
  const signals = digest.signals.slice(0, MAX_SIGNALS_IN_PROMPT);

  const signalLines = signals
    .map(
      (s) =>
        `- id: ${s.id} | type: ${s.type} | strength: ${s.strength.toFixed(2)} | ${s.headline}`,
    )
    .join('\n');

  const projectTitles = digest.raw.projects.map((p) => p.title).join(', ') || 'none';
  const positioning =
    [digest.raw.designer.bio, digest.raw.designer.specialties.join(', ')]
      .filter(Boolean)
      .join(' — ') || 'not stated';
  const priorAngles =
    digest.raw.priorQueuePieces.map((p) => p.angleType).join(', ') || 'none yet';

  return `DESIGNER POSITIONING: ${positioning}
PUBLISHED PROJECTS: ${projectTitles}
ANGLES ALREADY USED (avoid repeating): ${priorAngles}

SIGNALS (cite ONLY these ids):
${signalLines}`;
}

// Parse the model's JSON response into candidate angles. Tolerant of markdown
// fences; returns [] on any structural problem (the caller treats an empty
// result as "no angles this run", not an error).
export function parseAngleResponse(raw: string): CandidateAngle[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const angles = (parsed as { angles?: unknown })?.angles;
  if (!Array.isArray(angles)) return [];

  const out: CandidateAngle[] = [];
  for (const a of angles) {
    if (!a || typeof a !== 'object') continue;
    const row = a as Record<string, unknown>;
    if (typeof row.angleType !== 'string' || typeof row.summary !== 'string') continue;
    const signalIds = Array.isArray(row.signalIds)
      ? row.signalIds.filter((id): id is string => typeof id === 'string')
      : [];
    out.push({
      angleType: row.angleType,
      summary: row.summary,
      signalIds,
      confidence: typeof row.confidence === 'number' ? row.confidence : 0.5,
    });
  }
  return out;
}

// The one Anthropic call. Returns the validated split (accepted + rejected),
// or null when the model is unavailable or the call fails after retries — the
// caller decides what to do with null (typically: skip this run, try later).
export async function extractAngles(digest: CorpusDigest): Promise<AngleValidationResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (digest.signals.length === 0) return { accepted: [], rejected: [] };

  const client = new Anthropic();
  const userPrompt = buildAngleUserPrompt(digest);

  const result = await callLLM(
    () =>
      client.messages.create({
        model: MODELS.sonnet,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: ANGLE_EXTRACTION_MAX_TOKENS,
        temperature: ANGLE_EXTRACTION_TEMPERATURE,
      }),
    {
      modelName: MODELS.sonnet,
      contextHint: `operation=editorial_queue_angle_extraction`,
      maxRetries: 2,
    },
  );

  if (result.ok) {
    const raw = result.data.content[0]?.type === 'text' ? result.data.content[0].text : '';
    const candidates = parseAngleResponse(raw);
    const validated = validateAngles(candidates, digest.signals);

    if (validated.rejected.length > 0) {
      console.info('[extractAngles] rejected candidates by guard', {
        designerId: digest.designerId,
        rejected: validated.rejected.map((r) => r.reason),
      });
    }
    return validated;
  }

  const failureCode = 'code' in result ? result.code : 'unknown';
  console.warn('[extractAngles] call failed', { code: failureCode, designerId: digest.designerId });
  return null;
}

// Persist accepted angles as DesignerAngle rows. Returns the created ids.
export async function persistAngles(
  designerId: string,
  organizationId: string | null,
  angles: ExtractedAngle[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const angle of angles) {
    const created = await prisma.designerAngle.create({
      data: {
        designerId,
        organizationId,
        angleType: angle.angleType,
        summary: angle.summary,
        signalIds: angle.signalIds,
        evidence: angle.evidence as object,
        confidence: angle.confidence,
        isFresh: angle.isFresh,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}
