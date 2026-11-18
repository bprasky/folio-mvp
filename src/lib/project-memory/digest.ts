import { createHash } from 'crypto';

export type ProjectEvidenceKind = 'interview' | 'decision' | 'selection_change' | 'file' | 'image';
export interface ProjectEvidence {
  id: string;
  kind: ProjectEvidenceKind;
  recordedAt: string;
  occurredAt?: string;
  occurredAtBasis: 'recorded' | 'explicit';
  roomId?: string;
  text: string;
  sourceId: string;
  attribution: 'direct' | 'structured' | 'metadata';
}
export interface PrivateProjectDigest {
  projectId: string;
  title: string;
  generatedAt: string;
  sourceDigest: string;
  evidence: ProjectEvidence[];
  sourceCounts: Record<ProjectEvidenceKind, number>;
  limitations: string[];
}

export function buildPrivateDigest(input: {
  projectId: string;
  title: string;
  evidence: ProjectEvidence[];
  limitations?: string[];
  generatedAt?: string;
}): PrivateProjectDigest {
  const evidence = [...input.evidence].sort((a, b) => a.id.localeCompare(b.id));
  const sourceCounts: Record<ProjectEvidenceKind, number> = {
    interview: 0, decision: 0, selection_change: 0, file: 0, image: 0,
  };
  for (const item of evidence) sourceCounts[item.kind] += 1;
  const sourceDigest = createHash('sha256').update(JSON.stringify({
    projectId: input.projectId,
    evidence: evidence.map(({ id, sourceId, kind, text, recordedAt, occurredAt, occurredAtBasis, roomId, attribution }) =>
      ({ id, sourceId, kind, text, recordedAt, occurredAt, occurredAtBasis, roomId, attribution })),
  })).digest('hex');
  return {
    projectId: input.projectId,
    title: input.title,
    generatedAt: input.generatedAt || new Date().toISOString(),
    sourceDigest,
    evidence,
    sourceCounts,
    limitations: input.limitations || [],
  };
}
