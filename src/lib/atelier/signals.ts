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
  value?: string;
  weight?: number;
};

export async function recordAtelierSignal(input: SignalInput) {
  const { ownerType, designerId, vendorId, sourceType, sourceId, key, value, weight } = input;

  // Basic guard – we expect either designer OR vendor right now
  if (!designerId && !vendorId) {
    console.warn("[Atelier] recordAtelierSignal called without designerId or vendorId", input);
    return;
  }

  try {
    await prisma.atelierSignal.create({
      data: {
        ownerType,
        designerId,
        vendorId,
        sourceType,
        sourceId,
        key,
        value,
        weight: weight ?? 1.0,
      },
    });
  } catch (error) {
    // Log but don't throw - signal collection should be non-blocking
    console.error("[Atelier] Failed to record signal:", error, input);
  }
}




