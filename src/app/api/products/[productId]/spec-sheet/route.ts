// @idor-allow: public-read reason="Public PDF spec sheet for a product, generated anonymously"
// @idor-allow: IDOR003 reason="Public lookup by product id to render spec sheet"
// @idor-allow: IDOR004 reason="Read-only public spec sheet; no mutations in this route"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import PDFDocument from 'pdfkit';

// Design constants
const GOLD = '#c9a96e';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#666666';
const TEXT_TERTIARY = '#999999';
const DIVIDER = '#e0d8cf';
const WARM_BG = '#faf8f5';
const PAGE_WIDTH = 612; // Letter width in points
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * GET /api/products/[productId]/spec-sheet
 *
 * Generates a comprehensive PDF spec sheet by merging data from:
 * - Product table (core identity)
 * - CachedProduct table (AI-extracted specs: dimensions, materials, style)
 * - Vendor/User table (contact info)
 * - ProductTag (engagement count for vendor context)
 * - Save (save count for vendor context)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const productId = resolvedParams.productId;

  // 1. Fetch product with vendor
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      brand: true,
      description: true,
      price: true,
      imageUrl: true,
      url: true,
      category: true,
      threeDAssetUrl: true,
      vendorId: true,
      createdAt: true,
      vendor: {
        select: {
          name: true,
          companyName: true,
          email: true,
          website: true,
          location: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // 2. Fetch enriched data from CachedProduct (linked by URL)
  let cached: {
    widthIn: any; depthIn: any; heightIn: any;
    materialType: string | null; style: string | null;
    sku: string | null; priceCents: number | null; currency: string;
    colorPalette: any; roomSuitability: any; priceTier: string | null;
    categories: string[]; tags: string[];
    description: string | null; brand: string | null;
    vendorName: string | null; extractionConfidence: string;
  } | null = null;

  if (product.url) {
    cached = await prisma.cachedProduct.findUnique({
      where: { url: product.url },
      select: {
        widthIn: true, depthIn: true, heightIn: true,
        materialType: true, style: true,
        sku: true, priceCents: true, currency: true,
        colorPalette: true, roomSuitability: true, priceTier: true,
        categories: true, tags: true,
        description: true, brand: true,
        vendorName: true, extractionConfidence: true,
      },
    });
  }

  // 3. Fetch engagement counts
  const [saveCount, tagCount] = await Promise.all([
    prisma.save.count({ where: { productId } }),
    prisma.productTag.count({ where: { productId } }),
  ]);

  // --- Merge data (prefer CachedProduct enrichment, fallback to Product) ---
  const name = product.name;
  const brand = product.brand || cached?.brand || cached?.vendorName || product.vendor?.companyName || product.vendor?.name || null;
  const description = product.description || cached?.description || null;
  const sku = cached?.sku || null;
  const category = product.category || (cached?.categories?.length ? cached.categories[0] : null);

  const widthIn = cached?.widthIn ? Number(cached.widthIn) : 0;
  const depthIn = cached?.depthIn ? Number(cached.depthIn) : 0;
  const heightIn = cached?.heightIn ? Number(cached.heightIn) : 0;
  const hasDimensions = widthIn > 0 || depthIn > 0 || heightIn > 0;

  const materialType = cached?.materialType || null;
  const style = cached?.style || null;
  const priceTier = cached?.priceTier || null;
  const tags = cached?.tags || [];
  const categories = cached?.categories || [];

  let price: string | null = null;
  if (product.price) {
    price = `$${product.price.toLocaleString()}`;
  } else if (cached?.priceCents) {
    price = `$${(cached.priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  }

  // Parse room suitability
  let topRooms: { room: string; score: number }[] = [];
  if (cached?.roomSuitability && typeof cached.roomSuitability === 'object') {
    const rs = cached.roomSuitability as Record<string, number>;
    topRooms = Object.entries(rs)
      .filter(([, score]) => score > 0.3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([room, score]) => ({ room: room.replace(/_/g, ' '), score }));
  }

  // Parse color palette
  let colors: string[] = [];
  if (cached?.colorPalette && Array.isArray(cached.colorPalette)) {
    colors = cached.colorPalette.filter((c: unknown) => typeof c === 'string').slice(0, 5);
  }

  const vendorEmail = product.vendor?.email || null;
  const vendorWebsite = product.vendor?.website || null;
  const vendorLocation = product.vendor?.location || null;

  // ========== PDF GENERATION ==========

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 48, bottom: 48, left: MARGIN, right: MARGIN },
    info: {
      Title: `${name} — Specification Sheet`,
      Author: 'Folio',
      Subject: `Product specification for ${name}${brand ? ` by ${brand}` : ''}`,
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // --- Fetch product image ---
  let imageBuffer: Buffer | null = null;
  if (product.imageUrl) {
    try {
      const imgRes = await fetch(product.imageUrl, { signal: AbortSignal.timeout(8000) });
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuf);
      }
    } catch {
      // Image fetch failed — continue without it
    }
  }

  // ═══════════════════════════════════════════
  // HEADER SECTION
  // ═══════════════════════════════════════════

  // Top bar
  doc.fontSize(8).fillColor(GOLD).text('SPECIFICATION SHEET', MARGIN, 48, {
    align: 'left',
    characterSpacing: 2,
  });
  doc.fontSize(8).fillColor(TEXT_TERTIARY).text(
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    MARGIN, 48, { align: 'right' }
  );

  doc.moveDown(1.5);

  // Product name
  doc.fontSize(26).fillColor(TEXT_PRIMARY).text(name, { align: 'left' });
  if (brand) {
    doc.fontSize(12).fillColor(TEXT_SECONDARY).text(brand);
  }

  doc.moveDown(0.5);
  drawDivider(doc);
  doc.moveDown(1);

  // ═══════════════════════════════════════════
  // IMAGE + KEY SPECS (side by side if image available)
  // ═══════════════════════════════════════════

  const specsStartY = doc.y;

  if (imageBuffer) {
    try {
      // Image on the left (40% width)
      const imgWidth = CONTENT_WIDTH * 0.38;
      const imgHeight = imgWidth * 0.75; // 4:3 aspect
      doc.image(imageBuffer, MARGIN, specsStartY, {
        width: imgWidth,
        height: imgHeight,
        fit: [imgWidth, imgHeight],
        align: 'center',
        valign: 'center',
      });

      // Key specs on the right (55% width)
      const specsX = MARGIN + CONTENT_WIDTH * 0.42;
      const specsWidth = CONTENT_WIDTH * 0.58;
      let rightY = specsStartY;

      rightY = addSpecField(doc, 'Product', name, specsX, rightY, specsWidth);
      if (brand) rightY = addSpecField(doc, 'Brand', brand, specsX, rightY, specsWidth);
      if (sku) rightY = addSpecField(doc, 'SKU', sku, specsX, rightY, specsWidth);
      if (category) rightY = addSpecField(doc, 'Category', capitalize(category), specsX, rightY, specsWidth);
      if (hasDimensions) {
        const dimParts: string[] = [];
        if (widthIn > 0) dimParts.push(`${widthIn}"W`);
        if (depthIn > 0) dimParts.push(`${depthIn}"D`);
        if (heightIn > 0) dimParts.push(`${heightIn}"H`);
        rightY = addSpecField(doc, 'Dimensions', dimParts.join(' × '), specsX, rightY, specsWidth);
      }
      if (materialType) rightY = addSpecField(doc, 'Material', capitalize(materialType), specsX, rightY, specsWidth);
      if (style) rightY = addSpecField(doc, 'Style', capitalize(style), specsX, rightY, specsWidth);
      if (price) rightY = addSpecField(doc, 'Price', price, specsX, rightY, specsWidth);
      if (priceTier) rightY = addSpecField(doc, 'Price Tier', capitalize(priceTier), specsX, rightY, specsWidth);

      // Move doc.y to whichever column is taller
      const imgEndY = specsStartY + CONTENT_WIDTH * 0.38 * 0.75;
      doc.y = Math.max(imgEndY, rightY) + 16;
    } catch {
      // Image rendering failed, fall back to full-width specs
      renderFullWidthSpecs(doc, { name, brand, sku, category, hasDimensions, widthIn, depthIn, heightIn, materialType, style, price, priceTier });
    }
  } else {
    renderFullWidthSpecs(doc, { name, brand, sku, category, hasDimensions, widthIn, depthIn, heightIn, materialType, style, price, priceTier });
  }

  drawDivider(doc);
  doc.moveDown(1);

  // ═══════════════════════════════════════════
  // DESCRIPTION
  // ═══════════════════════════════════════════

  if (description) {
    doc.fontSize(9).fillColor(GOLD).text('DESCRIPTION', { characterSpacing: 1.5 });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(TEXT_PRIMARY).text(description, {
      lineGap: 3,
      width: CONTENT_WIDTH,
    });
    doc.moveDown(1);
    drawDivider(doc);
    doc.moveDown(1);
  }

  // ═══════════════════════════════════════════
  // DETAILED SPECIFICATIONS
  // ═══════════════════════════════════════════

  const hasDetailedSpecs = hasDimensions || materialType || style || tags.length > 0 || categories.length > 0 || topRooms.length > 0 || colors.length > 0;

  if (hasDetailedSpecs) {
    doc.fontSize(9).fillColor(GOLD).text('SPECIFICATIONS', { characterSpacing: 1.5 });
    doc.moveDown(0.5);

    // Two-column spec grid
    const colWidth = CONTENT_WIDTH / 2 - 8;
    const leftX = MARGIN;
    const rightX = MARGIN + CONTENT_WIDTH / 2 + 8;
    let leftY = doc.y;
    let rightY = doc.y;

    // Left column
    if (hasDimensions) {
      leftY = addSpecField(doc, 'Width', widthIn > 0 ? `${widthIn}"` : '—', leftX, leftY, colWidth);
      leftY = addSpecField(doc, 'Depth', depthIn > 0 ? `${depthIn}"` : '—', leftX, leftY, colWidth);
      leftY = addSpecField(doc, 'Height', heightIn > 0 ? `${heightIn}"` : '—', leftX, leftY, colWidth);
    }
    if (materialType) leftY = addSpecField(doc, 'Material Type', capitalize(materialType), leftX, leftY, colWidth);
    if (style) leftY = addSpecField(doc, 'Style', capitalize(style), leftX, leftY, colWidth);

    // Right column
    if (categories.length > 0) {
      rightY = addSpecField(doc, 'Categories', categories.map(capitalize).join(', '), rightX, rightY, colWidth);
    }
    if (topRooms.length > 0) {
      rightY = addSpecField(doc, 'Recommended Rooms', topRooms.map(r => capitalize(r.room)).join(', '), rightX, rightY, colWidth);
    }
    if (priceTier) rightY = addSpecField(doc, 'Price Tier', capitalize(priceTier), rightX, rightY, colWidth);
    if (tags.length > 0) {
      rightY = addSpecField(doc, 'Tags', tags.slice(0, 8).map(capitalize).join(', '), rightX, rightY, colWidth);
    }

    doc.y = Math.max(leftY, rightY) + 8;
    doc.moveDown(0.5);
    drawDivider(doc);
    doc.moveDown(1);
  }

  // ═══════════════════════════════════════════
  // VENDOR / CONTACT INFO
  // ═══════════════════════════════════════════

  const hasVendorInfo = brand || vendorEmail || vendorWebsite || vendorLocation || product.url;

  if (hasVendorInfo) {
    doc.fontSize(9).fillColor(GOLD).text('VENDOR & CONTACT', { characterSpacing: 1.5 });
    doc.moveDown(0.5);

    let vy = doc.y;
    if (brand) vy = addSpecField(doc, 'Brand / Manufacturer', brand, MARGIN, vy, CONTENT_WIDTH);
    if (vendorLocation) vy = addSpecField(doc, 'Location', vendorLocation, MARGIN, vy, CONTENT_WIDTH);
    if (vendorEmail) vy = addSpecField(doc, 'Email', vendorEmail, MARGIN, vy, CONTENT_WIDTH);
    if (vendorWebsite) vy = addSpecField(doc, 'Website', vendorWebsite, MARGIN, vy, CONTENT_WIDTH);
    if (product.url) vy = addSpecField(doc, 'Product URL', product.url, MARGIN, vy, CONTENT_WIDTH);

    doc.y = vy + 4;
    doc.moveDown(0.5);
    drawDivider(doc);
    doc.moveDown(1);
  }

  // ═══════════════════════════════════════════
  // AVAILABLE FILES
  // ═══════════════════════════════════════════

  const files: string[] = [];
  if (product.threeDAssetUrl) files.push('3D Model (.glb)');
  // Could extend with specSheetPdfUrl, CAD files from CachedProduct if those fields are added

  if (files.length > 0) {
    doc.fontSize(9).fillColor(GOLD).text('AVAILABLE FILES', { characterSpacing: 1.5 });
    doc.moveDown(0.3);
    files.forEach(f => {
      doc.fontSize(10).fillColor(TEXT_PRIMARY).text(`  •  ${f}`);
    });
    doc.moveDown(1);
    drawDivider(doc);
    doc.moveDown(1);
  }

  // ═══════════════════════════════════════════
  // ENGAGEMENT (optional context — useful for vendors)
  // ═══════════════════════════════════════════

  if (saveCount > 0 || tagCount > 0) {
    doc.fontSize(9).fillColor(GOLD).text('COMMUNITY ENGAGEMENT', { characterSpacing: 1.5 });
    doc.moveDown(0.3);
    const engagementParts: string[] = [];
    if (saveCount > 0) engagementParts.push(`${saveCount} designer save${saveCount !== 1 ? 's' : ''}`);
    if (tagCount > 0) engagementParts.push(`${tagCount} project tag${tagCount !== 1 ? 's' : ''}`);
    doc.fontSize(10).fillColor(TEXT_PRIMARY).text(engagementParts.join('  •  '));
    doc.moveDown(1);
  }

  // ═══════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════

  // Place footer at bottom of page
  const footerY = 720;
  if (doc.y < footerY - 30) {
    doc.y = footerY;
  }

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).strokeColor(DIVIDER).lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  doc.fontSize(7).fillColor(TEXT_TERTIARY).text(
    'Generated by Folio  •  folioad.com  •  Specification data sourced from vendor websites and AI-assisted extraction.',
    { align: 'center' }
  );
  if (cached?.extractionConfidence) {
    doc.fontSize(7).fillColor(TEXT_TERTIARY).text(
      `Data confidence: ${cached.extractionConfidence}. Always verify specifications with the manufacturer before procurement.`,
      { align: 'center' }
    );
  }

  doc.end();
  const pdfBuffer = await pdfPromise;

  const filename = `${name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_Spec_Sheet.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function drawDivider(doc: PDFKit.PDFDocument) {
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .strokeColor(DIVIDER).lineWidth(0.5).stroke();
}

function addSpecField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.fontSize(8).fillColor(TEXT_TERTIARY).text(label.toUpperCase(), x, y, { width, characterSpacing: 0.5 });
  const labelHeight = doc.heightOfString(label.toUpperCase(), { width, characterSpacing: 0.5 });
  doc.fontSize(10).fillColor(TEXT_PRIMARY).text(value, x, y + labelHeight + 1, { width });
  const valueHeight = doc.heightOfString(value, { width });
  return y + labelHeight + valueHeight + 10;
}

function renderFullWidthSpecs(
  doc: PDFKit.PDFDocument,
  specs: {
    name: string; brand: string | null; sku: string | null;
    category: string | null; hasDimensions: boolean;
    widthIn: number; depthIn: number; heightIn: number;
    materialType: string | null; style: string | null;
    price: string | null; priceTier: string | null;
  }
) {
  let y = doc.y;
  const colWidth = CONTENT_WIDTH / 2 - 8;
  const leftX = MARGIN;
  const rightX = MARGIN + CONTENT_WIDTH / 2 + 8;
  let leftY = y;
  let rightY = y;

  // Left column
  if (specs.brand) leftY = addSpecField(doc, 'Brand', specs.brand, leftX, leftY, colWidth);
  if (specs.sku) leftY = addSpecField(doc, 'SKU', specs.sku, leftX, leftY, colWidth);
  if (specs.category) leftY = addSpecField(doc, 'Category', capitalize(specs.category), leftX, leftY, colWidth);
  if (specs.materialType) leftY = addSpecField(doc, 'Material', capitalize(specs.materialType), leftX, leftY, colWidth);

  // Right column
  if (specs.hasDimensions) {
    const dimParts: string[] = [];
    if (specs.widthIn > 0) dimParts.push(`${specs.widthIn}"W`);
    if (specs.depthIn > 0) dimParts.push(`${specs.depthIn}"D`);
    if (specs.heightIn > 0) dimParts.push(`${specs.heightIn}"H`);
    rightY = addSpecField(doc, 'Dimensions', dimParts.join(' × '), rightX, rightY, colWidth);
  }
  if (specs.style) rightY = addSpecField(doc, 'Style', capitalize(specs.style), rightX, rightY, colWidth);
  if (specs.price) rightY = addSpecField(doc, 'Price', specs.price, rightX, rightY, colWidth);
  if (specs.priceTier) rightY = addSpecField(doc, 'Price Tier', capitalize(specs.priceTier), rightX, rightY, colWidth);

  doc.y = Math.max(leftY, rightY) + 8;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
