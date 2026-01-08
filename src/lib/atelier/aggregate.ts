// Atelier fingerprint computation
// NOTE: Atelier models not in Prisma schema - functionality disabled

// Local type definitions for when Prisma models are added
export type AtelierOwnerType = "DESIGNER" | "VENDOR";
export type AtelierNodeType =
  | "STYLE"
  | "ROOM_TYPE"
  | "MATERIAL"
  | "VENDOR"
  | "PRODUCT_CATEGORY"
  | "COLOR_CLUSTER"
  | "BEHAVIOR";
export type AtelierRelationType =
  | "PROJECT_ROOM_FOCUS"
  | "FREQUENT_VENDOR"
  | "PREFERS";
export type AtelierSignalSourceType = "PROJECT" | "PRODUCT_SAVE" | "BEHAVIOR";

export async function recomputeDesignerAtelierFingerprint(designerId: string) {
  // Atelier models not in Prisma schema - return null until implemented
  console.warn(
    `recomputeDesignerAtelierFingerprint: Atelier models not available for designer ${designerId}`
  );
  return null;
}
