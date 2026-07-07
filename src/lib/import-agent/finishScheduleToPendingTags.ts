import { prisma } from '@/lib/prisma';
import type { FinishScheduleRow } from './parseFinishSchedule';

/**
 * Adapter: parsed finish-schedule rows → PendingProductTag rows (source = SPEC),
 * the same reviewable queue the PDF spec importer feeds (see pdfSpecToPendingTags).
 *
 * Unlike the PDF adapter, this keeps the finish-schedule's own room column
 * (roomType) and the raw dimensions string, which a finish book carries but the
 * PDF ExtractionResult shape would flatten away.
 */
function rowToTag(row: FinishScheduleRow, importSessionId: string) {
  const hasStructuredData = Boolean(row.brand || row.price != null || row.sku);
  const material = [row.material, row.finish].filter(Boolean).join(', ') || null;

  return {
    importSessionId,
    source: 'SPEC' as const,
    // Finish-schedule items aren't positioned on a project image yet; center as
    // a sensible default (matching the PDF spec adapter).
    x: 0.5,
    y: 0.5,
    description: row.name,
    category: row.category || 'OTHER',
    searchQuery: [row.brand, row.name].filter(Boolean).join(' ') || row.name,
    suggestions: [],
    detectionConfidence: hasStructuredData ? 'high' : 'medium',
    roomType: row.room,
    extractedVendor: row.brand,
    extractedPrice: row.price,
    extractedDimensions: row.dimensions,
    extractedSku: row.sku,
    extractedMaterial: material,
    extractedProductUrl: row.url,
  };
}

/**
 * Create PendingProductTag rows (source = SPEC) on the given import session from
 * parsed finish-schedule rows. Returns the number of tags created.
 */
export async function finishScheduleToPendingTags(
  importSessionId: string,
  rows: FinishScheduleRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const data = rows.map((row) => rowToTag(row, importSessionId));
  const created = await prisma.pendingProductTag.createMany({ data });

  // Keep the session's product counter in sync for the review UI.
  await prisma.importSession.update({
    where: { id: importSessionId },
    data: { totalProducts: { increment: created.count } },
  });

  return created.count;
}
