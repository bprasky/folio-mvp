import { prisma } from "@/lib/prisma";
import { AtelierOwnerType, AtelierSignalSourceType } from "@prisma/client";

type BaseSignalContext = {
  designerId?: string;
  vendorId?: string;
  ownerType: AtelierOwnerType;
};

type SignalInput = BaseSignalContext & {
  sourceType: AtelierSignalSourceType;
  sourceId?: string;
  key: string;
  /** @deprecated Use metadata instead — AtelierSignal has no `value` column. Stored in metadata.value for backward compat. */
  value?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
};

export async function recordAtelierSignal(input: SignalInput) {
  const { ownerType, designerId, vendorId, sourceType, sourceId, key, value, weight, metadata } =
    input;

  // Basic guard – we expect either designer OR vendor right now
  if (!designerId && !vendorId) {
    console.warn("[Atelier] recordAtelierSignal called without designerId or vendorId", input);
    return;
  }

  // Merge value into metadata — the schema has no `value` column,
  // only `metadata Json?`. This preserves backward compatibility for callers
  // that still pass `value` as a string.
  const mergedMetadata: Record<string, unknown> | undefined =
    value || metadata
      ? { ...(metadata || {}), ...(value !== undefined ? { value } : {}) }
      : undefined;

  try {
    await prisma.atelierSignal.create({
      data: {
        ownerType,
        designerId,
        vendorId,
        sourceType,
        sourceId,
        key,
        weight: weight ?? 1.0,
        metadata: mergedMetadata,
      },
    });
  } catch (error) {
    // Log but don't throw - signal collection should be non-blocking
    console.error("[Atelier] Failed to record signal:", error, input);
  }
}




