import { prisma } from '@/lib/prisma';

/**
 * Vision label-event sink (training-data flywheel).
 *
 * Append-only record of every model PREDICTION and every human CORRECTION,
 * tagged with the model that produced it, so the prediction→correction delta
 * is computable across whatever vision tool is in use today or tomorrow.
 *
 * Fire-and-forget by contract: this NEVER throws. A logging failure must never
 * break the user action it's observing. Callers may await it (to ensure the
 * write lands before a serverless function returns) without risk.
 */
export interface LabelEventInput {
  projectId: string;
  imageId?: string | null;
  roomId?: string | null;
  userId?: string | null;
  source: 'MODEL' | 'HUMAN';
  /** Model id for MODEL events, e.g. "claude-sonnet-4-6". */
  model?: string | null;
  /** ROOM | ROOM_NAME | INCLUSION | NO_PRODUCTS | PRODUCT_TAG */
  taskType: string;
  /** predict | assign | unassign | exclude | include | rename | confirm | correct | dismiss | no_products */
  action?: string | null;
  /** The predicted label or the human-chosen value (include AI context for self-describing rows). */
  value: Record<string, unknown>;
}

export async function recordLabelEvent(input: LabelEventInput): Promise<void> {
  try {
    await prisma.visionLabelEvent.create({
      data: {
        projectId: input.projectId,
        imageId: input.imageId ?? null,
        roomId: input.roomId ?? null,
        userId: input.userId ?? null,
        source: input.source,
        model: input.model ?? null,
        taskType: input.taskType,
        action: input.action ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: input.value as any,
      },
    });
  } catch (err) {
    console.error('[recordLabelEvent] non-blocking failure:', err);
  }
}
