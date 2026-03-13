import prisma from "@/lib/prisma";

/**
 * Get the attribution chain for a product relative to a user.
 * Traces: EventProductScan → Save → ProductTag → (future: ShopProduct → Purchase)
 */
export async function getProductAttribution(
  userId: string,
  productId: string
) {
  // Check if product was discovered at an event
  const scan = await prisma.eventProductScan.findFirst({
    where: { userId, productId },
    include: { event: { select: { id: true, title: true } } },
    orderBy: { scannedAt: "asc" },
  });

  if (!scan) return null;

  // Check if product was tagged in a project
  const productTag = await prisma.productTag.findFirst({
    where: {
      productId,
      image: { project: { userId } },
    },
    include: {
      image: {
        select: {
          project: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Check if product was saved
  const save = await prisma.save.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, source: true, createdAt: true },
  });

  return {
    discoveredAt: {
      eventId: scan.event.id,
      eventTitle: scan.event.title,
      scannedAt: scan.scannedAt,
      scanMethod: scan.scanMethod,
    },
    saved: save
      ? {
          saveId: save.id,
          source: save.source,
          savedAt: save.createdAt,
        }
      : null,
    tagged: productTag
      ? {
          projectId: productTag.image?.project?.id,
          projectTitle: productTag.image?.project?.title,
        }
      : null,
  };
}

/**
 * Get conversion metrics for an event's scanned products.
 * Shows how many scans converted to saves, tags, etc.
 */
export async function getEventScanConversions(eventId: string) {
  const scans = await prisma.eventProductScan.findMany({
    where: { eventId },
    select: {
      userId: true,
      productId: true,
      autoSavedId: true,
    },
  });

  const scanPairs = scans.map((s) => ({
    userId: s.userId,
    productId: s.productId,
  }));

  // Count scans that led to saves (via autoSavedId)
  const savedCount = scans.filter((s) => s.autoSavedId).length;

  // Count scans that led to product tags
  let taggedCount = 0;
  if (scanPairs.length > 0) {
    // Batch query: find ProductTags where userId (via project) + productId matches a scan
    const tags = await prisma.productTag.findMany({
      where: {
        productId: { in: [...new Set(scanPairs.map((p) => p.productId))] },
        image: {
          project: {
            userId: { in: [...new Set(scanPairs.map((p) => p.userId))] },
          },
        },
      },
      select: {
        productId: true,
        image: { select: { project: { select: { userId: true } } } },
      },
    });

    const scanSet = new Set(
      scanPairs.map((p) => `${p.userId}:${p.productId}`)
    );
    taggedCount = tags.filter((t) =>
      scanSet.has(`${t.image?.project?.userId}:${t.productId}`)
    ).length;
  }

  return {
    totalScans: scans.length,
    savedCount,
    taggedCount,
    saveRate: scans.length > 0 ? savedCount / scans.length : 0,
    tagRate: scans.length > 0 ? taggedCount / scans.length : 0,
  };
}
