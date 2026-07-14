// Editorial Queue — the validation-reject rule (docs/17_EDITORIAL_QUEUE.md,
// Component 2). Pure and fixture-testable: no API, no Prisma.
//
// This is the hallucination guard. The model ranks signals into angles; this
// function guarantees every persisted angle cites only real signals and that
// DesignerAngle.evidence always resolves to verifiable rows. An angle survives
// only if it cites at least one signal ID present in the digest AND every ID it
// cites resolves — a single fabricated citation rejects the whole angle,
// because a made-up citation means the model invented, and the angle is suspect.

import { ANGLE_TYPES } from './types';
import type {
  AngleType,
  AngleValidationResult,
  CandidateAngle,
  ComputedSignal,
  ExtractedAngle,
  RejectedAngle,
  SignalEvidence,
} from './types';

// Merge the row-level evidence of several signals into one deduplicated set.
function mergeEvidence(signals: ComputedSignal[]): SignalEvidence {
  const projectIds = new Set<string>();
  const imageIds = new Set<string>();
  const productIds = new Set<string>();
  const productTagIds = new Set<string>();
  const interviewAnswerIds = new Set<string>();
  const facts: Record<string, string | number | string[]> = {};

  for (const signal of signals) {
    for (const id of signal.evidence.projectIds ?? []) projectIds.add(id);
    for (const id of signal.evidence.imageIds ?? []) imageIds.add(id);
    for (const id of signal.evidence.productIds ?? []) productIds.add(id);
    for (const id of signal.evidence.productTagIds ?? []) productTagIds.add(id);
    for (const id of signal.evidence.interviewAnswerIds ?? []) interviewAnswerIds.add(id);
    // Namespace each signal's facts by its ID so keys can't collide.
    if (signal.evidence.facts) {
      for (const [key, value] of Object.entries(signal.evidence.facts)) {
        facts[`${signal.id}.${key}`] = value;
      }
    }
  }

  const evidence: SignalEvidence = {};
  if (projectIds.size) evidence.projectIds = Array.from(projectIds);
  if (imageIds.size) evidence.imageIds = Array.from(imageIds);
  if (productIds.size) evidence.productIds = Array.from(productIds);
  if (productTagIds.size) evidence.productTagIds = Array.from(productTagIds);
  if (interviewAnswerIds.size) evidence.interviewAnswerIds = Array.from(interviewAnswerIds);
  if (Object.keys(facts).length) evidence.facts = facts;
  return evidence;
}

function isAngleType(value: string): value is AngleType {
  return (ANGLE_TYPES as readonly string[]).includes(value);
}

/**
 * Apply the validation-reject rule to the model's candidate angles.
 *
 * @param candidates  Raw angles as returned by the model.
 * @param signals     The exact signal set the model was given (the digest's).
 * @returns           Accepted angles (with resolved evidence) and rejected ones
 *                    tagged with why, for observability.
 */
export function validateAngles(
  candidates: CandidateAngle[],
  signals: ComputedSignal[],
): AngleValidationResult {
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const accepted: ExtractedAngle[] = [];
  const rejected: RejectedAngle[] = [];

  for (const candidate of candidates) {
    const summary = candidate.summary?.trim() ?? '';
    if (!summary) {
      rejected.push({ candidate, reason: 'empty_summary' });
      continue;
    }
    if (!isAngleType(candidate.angleType)) {
      rejected.push({ candidate, reason: 'unknown_angle_type' });
      continue;
    }

    const cited = Array.from(new Set(candidate.signalIds ?? []));
    if (cited.length === 0) {
      rejected.push({ candidate, reason: 'no_valid_citation' });
      continue;
    }

    const fabricated = cited.filter((id) => !signalById.has(id));
    if (fabricated.length > 0) {
      // A single invented citation rejects the whole angle — the guard.
      rejected.push({ candidate, reason: 'fabricated_citation', fabricatedIds: fabricated });
      continue;
    }

    const citedSignals = cited.map((id) => signalById.get(id)!);
    accepted.push({
      angleType: candidate.angleType,
      summary,
      signalIds: cited,
      confidence: clampConfidence(candidate.confidence),
      evidence: mergeEvidence(citedSignals),
      isFresh: true,
    });
  }

  return { accepted, rejected };
}

function clampConfidence(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
