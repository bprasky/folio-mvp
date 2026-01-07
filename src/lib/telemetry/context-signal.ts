import { prisma } from "@/lib/prisma";

export interface ContextSignalInput {
  userId?: string;
  vendorId?: string;
  productId?: string;
  projectId?: string;
  eventId?: string;
  materialId?: string;
  action: string; // "view" | "save" | "add_to_project" | "rsvp" | "feature_click" | "search"
  tags?: string[];
  meta?: any;
}

/**
 * Log a context signal to track user actions and build the context graph
 * 
 * @param input - The signal data to log
 * @returns The created ContextSignal record
 */
export async function logSignal(input: ContextSignalInput) {
  try {
    return await prisma.contextSignal.create({
      data: {
        userId: input.userId,
        vendorId: input.vendorId,
        productId: input.productId,
        projectId: input.projectId,
        eventId: input.eventId,
        materialId: input.materialId,
        action: input.action,
        tags: input.tags || [],
        meta: input.meta,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("[ContextSignal] Failed to log signal:", error);
    return null;
  }
}

/**
 * Batch log multiple signals at once for efficiency
 */
export async function logSignalBatch(inputs: ContextSignalInput[]) {
  try {
    return await prisma.contextSignal.createMany({
      data: inputs.map(input => ({
        userId: input.userId,
        vendorId: input.vendorId,
        productId: input.productId,
        projectId: input.projectId,
        eventId: input.eventId,
        materialId: input.materialId,
        action: input.action,
        tags: input.tags || [],
        meta: input.meta,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("[ContextSignal] Failed to log signal batch:", error);
    return null;
  }
}

/**
 * Helper to extract tags from various sources (product categories, event types, etc.)
 */
export function extractTags(source: {
  category?: string | null;
  brand?: string | null;
  tags?: string[];
  eventTypes?: string[];
  designStyles?: string[];
}): string[] {
  const tags: string[] = [];
  
  if (source.category) tags.push(source.category.toLowerCase());
  if (source.brand) tags.push(source.brand.toLowerCase());
  if (source.tags) tags.push(...source.tags.map(t => t.toLowerCase()));
  if (source.eventTypes) tags.push(...source.eventTypes.map(t => t.toLowerCase()));
  if (source.designStyles) tags.push(...source.designStyles.map(t => t.toLowerCase()));
  
  return Array.from(new Set(tags)); // Remove duplicates
}

