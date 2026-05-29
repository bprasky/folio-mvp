import { prisma } from '@/lib/prisma';
import type { ExtractionResult } from '@/lib/pdf/extractionPipeline';
import type { ExtractedItem } from '@/lib/pdf/confidence';
import type { ParsedDimensions } from '@/lib/pdf/patterns';

/**
 * Adapter: PdfExtraction (spec-text pipeline) → PendingProductTag rows.
 *
 * The PRESENTATION import pipeline produces vision-detected PendingProductTags
 * (source = VISION). This maps the structured items from PDF spec extraction
 * onto the SAME ImportSession as reviewable tags (source = SPEC) so both flow
 * through one verification queue. Spec items carry the extracted* fields and an
 * empty suggestions array (no web attribution is performed here).
 */

function formatDimensions(d: ParsedDimensions | null | undefined): string | null {
  if (!d) return null;
  const unit = d.unit === 'cm' ? 'cm' : '"';
  if (d.diameter) return `${d.diameter}${unit} dia`;
  const parts: string[] = [];
  if (d.width) parts.push(`${d.width}W`);
  if (d.depth) parts.push(`${d.depth}D`);
  if (d.height) parts.push(`${d.height}H`);
  if (d.length) parts.push(`${d.length}L`);
  return parts.length ? `${parts.join(' x ')} ${unit === 'cm' ? 'cm' : 'in'}` : null;
}

function itemToTag(item: ExtractedItem, importSessionId: string) {
  const description =
    item.description || item.productName || item.brand || item.searchQuery || 'Spec item';

  return {
    importSessionId,
    source: 'SPEC' as const,
    // Spec items aren't positioned on a project image; center as a sensible default.
    x: 0.5,
    y: 0.5,
    description,
    category: 'OTHER',
    searchQuery: item.searchQuery || description,
    suggestions: [],
    detectionConfidence: item.confidence,
    extractedVendor: item.vendor || item.brand || null,
    extractedPrice: typeof item.price === 'number' ? item.price : null,
    extractedDimensions: formatDimensions(item.dimensions),
    extractedSku: item.sku || null,
    extractedMaterial: item.material || null,
    extractedProductUrl: item.productUrl || null,
  };
}

/**
 * Create PendingProductTag rows (source = SPEC) on the given import session from
 * a PDF extraction result. Only specification items (real products) are mapped;
 * inspiration images are skipped. Returns the number of tags created.
 */
export async function pdfSpecToPendingTags(
  importSessionId: string,
  result: ExtractionResult
): Promise<number> {
  const items = [...result.items.high, ...result.items.medium, ...result.items.low].filter(
    (item) => item.type === 'specification'
  );

  if (items.length === 0) return 0;

  const data = items.map((item) => itemToTag(item, importSessionId));
  const created = await prisma.pendingProductTag.createMany({ data });

  // Keep the session's product counter in sync for the review UI.
  await prisma.importSession.update({
    where: { id: importSessionId },
    data: { totalProducts: { increment: created.count } },
  });

  return created.count;
}
