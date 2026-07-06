export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
import ExcelJS from 'exceljs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: projectId } = params;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const format = searchParams.get('format') || 'xlsx';
    const roomId = searchParams.get('roomId');

    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Export is read-only, so it requires only VIEW access: the owner/designer
    // or any participant (including org-level VIEWERs) may export. Edit-level
    // role is not required to read the spec.
    let access;
    try {
      access = await assertProjectView(session.user.id, projectId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trade pricing and lead time are business-sensitive (wholesale cost), so
    // only OWNER/EDITOR may include them. Viewers get the base spec without
    // these columns even if they pass the query flags.
    const canIncludePricing = ['OWNER', 'EDITOR'].includes(access.role);
    const includePricing =
      canIncludePricing && searchParams.get('includePricing') === 'true';
    const includeLeadTime =
      canIncludePricing && searchParams.get('includeLeadTime') === 'true';

    // Fetch project (title only — products now come from ProductTags).
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Source the export from ProductTags on the project's images rather than
    // room Selections. Every product the designer tagged on a photo is
    // included, grouped by that photo's room. This tracks tags directly, so
    // deleting a project's tags empties the export (closed-loop import test).
    const tags = await prisma.productTag.findMany({
      where: {
        image: {
          projectId,
          ...(scope === 'current' && roomId ? { roomId } : {}),
        },
      },
      select: {
        productId: true,
        product: { select: { name: true, brand: true, url: true, price: true } },
        image: {
          select: {
            room: true,
            roomId: true,
            assignedRoom: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch pricing data if requested
    let pricingMap = new Map<string, { unitPriceTrade: number | null; leadTimeWeeks: number | null; availability: string | null }>();
    if (includePricing || includeLeadTime) {
      const pricing = await prisma.projectProductPricing.findMany({
        where: { projectId },
      });
      for (const p of pricing) {
        const key = `${p.productId}-${p.roomId || ''}`;
        pricingMap.set(key, {
          unitPriceTrade: p.unitPriceTrade ? Number(p.unitPriceTrade) : null,
          leadTimeWeeks: p.leadTimeWeeks,
          availability: p.availability,
        });
      }
    }

    // Build export data — one row per product per room (a product tagged on
    // several photos in the same room collapses to a single line).
    const exportData: Array<{
      projectName: string;
      room: string;
      boardSection: string;
      productName: string;
      vendorBrand: string;
      sku: string;
      url: string;
      price: string;
      tradePricing: string;
      leadTime: string;
      availability: string;
      unit: string;
      quantity: string;
      notes: string;
    }> = [];

    const seen = new Set<string>();
    for (const tag of tags) {
      const roomLabel = tag.image.assignedRoom?.name || tag.image.room || 'Unspecified';
      const dedupeKey = `${tag.image.roomId || roomLabel}-${tag.productId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Look up pricing from ProjectProductPricing
      const pricingKey = `${tag.productId}-${tag.image.roomId || ''}`;
      const pricingKeyNoRoom = `${tag.productId}-`;
      const pricing = pricingMap.get(pricingKey) || pricingMap.get(pricingKeyNoRoom);

      exportData.push({
        projectName: project.title || 'Untitled Project',
        room: roomLabel,
        boardSection: '',
        productName: tag.product?.name || 'Untitled Product',
        vendorBrand: tag.product?.brand || '',
        sku: '',
        url: tag.product?.url || '',
        price: tag.product?.price ? `$${Number(tag.product.price).toFixed(2)}` : '',
        tradePricing: pricing?.unitPriceTrade ? `$${pricing.unitPriceTrade.toFixed(2)}` : '',
        leadTime: pricing?.leadTimeWeeks ? `${pricing.leadTimeWeeks} wk` : '',
        availability: pricing?.availability || '',
        unit: 'ea',
        quantity: '',
        notes: '',
      });
    }

    // Group rooms together, products alphabetical within a room.
    exportData.sort(
      (a, b) => a.room.localeCompare(b.room) || a.productName.localeCompare(b.productName),
    );

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const projectSlug = project.title
      ? project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : projectId;
    const filename = `folio-spec-${projectSlug}-${dateStr}.${format}`;

    if (format === 'xlsx') {
      // Generate XLSX
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Specification');

      // Add headers
      const columns: Array<Partial<ExcelJS.Column>> = [
        { header: 'Project Name', key: 'projectName', width: 20 },
        { header: 'Room', key: 'room', width: 15 },
        { header: 'Board Section', key: 'boardSection', width: 20 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'Vendor / Brand', key: 'vendorBrand', width: 20 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'URL', key: 'url', width: 40 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Notes', key: 'notes', width: 40 },
      ];

      if (includePricing) {
        columns.push({ header: 'Trade Price', key: 'tradePricing', width: 14 });
      }
      if (includeLeadTime) {
        columns.push({ header: 'Lead Time', key: 'leadTime', width: 12 });
        columns.push({ header: 'Availability', key: 'availability', width: 16 });
      }

      worksheet.columns = columns;

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Add data
      exportData.forEach(row => {
        worksheet.addRow(row);
      });

      // Auto-size columns
      worksheet.columns.forEach(column => {
        if (column.width) {
          column.width = Math.min(column.width || 10, 50);
        }
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else if (format === 'pdf') {
      // Generate PDF with pdf-lib. Unlike pdfkit, pdf-lib embeds the standard
      // fonts without reading any files at runtime, so it works on serverless
      // (no Helvetica.afm ENOENT). The title uses Times-Italic and the body
      // Helvetica — both StandardFonts, no embedding. StandardFonts use WinAnsi
      // encoding, so we sanitize text to ASCII (plus the middot separator, which
      // is valid WinAnsi) to avoid "cannot encode" errors on stray unicode.
      //
      // Layout (see docs/17_SPEC_SHEET_EXPORT.md): no flat grid. Products group
      // under room section headers; each product is a wrapped two-line entry
      // with a fixed right rail for price. Nothing truncates — long names wrap.
      const { PDFDocument, StandardFonts, rgb, PDFName, PDFString } = await import('pdf-lib');

      const pageWidth = 612; // US Letter, points
      const pageHeight = 792;
      const marginX = 50;
      const contentWidth = pageWidth - 2 * marginX; // 512
      const bottomLimit = 60; // content must not cross into the footer band

      // Brand tokens (docs/17): ink #1A1A1A, gold #C9A96E, taupe #8A7E70,
      // warm header band #FAF8F5. Gold is reserved for header/room rules only.
      const ink = rgb(0.102, 0.102, 0.102);
      const gold = rgb(0.788, 0.663, 0.431);
      const taupe = rgb(0.541, 0.494, 0.439);
      const warm = rgb(0.98, 0.973, 0.961);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

      // Replace common typographic chars, then drop anything outside printable
      // ASCII — but keep U+00B7 (middot), the meta separator, which WinAnsi can
      // encode. Without this carve-out the separator would silently vanish.
      const ascii = (text: unknown): string =>
        (text ?? '')
          .toString()
          .replace(/[‘’]/g, "'")
          .replace(/[“”]/g, '"')
          .replace(/[–—]/g, '-')
          .replace(/…/g, '...')
          .replace(/ /g, ' ')
          .replace(/[^\x20-\x7E·]/g, '');

      // Break text into lines that each fit maxWidth. Never truncates: a single
      // word wider than maxWidth gets its own (over-wide) line rather than a cut.
      const wrap = (text: unknown, f: typeof font, size: number, maxWidth: number): string[] => {
        const clean = ascii(text);
        if (!clean) return [];
        const words = clean.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (!current || f.widthOfTextAtSize(candidate, size) <= maxWidth) {
            current = candidate;
          } else {
            lines.push(current);
            current = word;
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      // Currency: thousands separator + two decimals, correctly rounded. Manual
      // (not toLocaleString) so output is deterministic regardless of ICU build.
      const formatCurrency = (n: number): string => {
        const [whole, frac] = (Math.round(n * 100) / 100).toFixed(2).split('.');
        return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
      };

      // exportData carries price as a pre-formatted "$384.00" string (shared
      // with the XLSX branch). Parse the number back out for re-formatting and
      // for totals; '' means no price.
      const parsePrice = (s: string): number | null => {
        if (!s) return null;
        const n = parseFloat(s.replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) ? n : null;
      };
      const parseQty = (s: string): number | null => {
        if (!s) return null;
        const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      // Bare hostname (www stripped) for display; full row.url stays the href.
      const domainOf = (url: string): string => {
        if (!url) return '';
        try {
          return new URL(url).hostname.replace(/^www\./, '');
        } catch {
          return ascii(url);
        }
      };

      // --- type sizes / line heights ---------------------------------------
      const nameSize = 12;
      const nameLH = 15;
      const metaSize = 9;
      const metaLH = 13;
      const priceSize = 11;
      const priceLH = 14;
      const railSize = 8.5;
      const railLH = 12;
      const roomLabelSize = 12;
      const entryGap = 9;

      const rightRailWidth = 130;
      const railGap = 18;
      const nameWidth = contentWidth - rightRailWidth - railGap; // 364
      const railRight = pageWidth - marginX; // right edge of the rail

      const titleText = ascii(project.title || 'Project Specification');
      const genDate = new Date().toLocaleDateString();
      const roomCount = new Set(exportData.map((r) => r.room)).size;
      const itemCount = exportData.length;

      // Add a clickable URI link annotation over a drawn run of text.
      // pdf-lib 1.17.1 has no high-level link API, so build the annotation dict
      // by hand: /Subtype /Link, a /Rect over the text, /A a /URI action.
      const addLink = (
        pg: ReturnType<typeof pdfDoc.addPage>,
        x: number,
        baseline: number,
        width: number,
        size: number,
        url: string,
      ) => {
        const annot = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, baseline - 2, x + width, baseline + size],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
        });
        const ref = pdfDoc.context.register(annot);
        const existing = pg.node.Annots();
        if (existing) {
          existing.push(ref);
        } else {
          pg.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
        }
      };

      type Entry = {
        nameLines: string[];
        metaRuns: Array<{ text: string; link?: string }>;
        notesLines: string[];
        priceStr: string;
        priceNum: number | null;
        qtyStr: string;
        tradeStr: string;
        leadStr: string;
      };

      const buildEntry = (row: (typeof exportData)[number]): Entry => {
        const nameLines = wrap(row.productName || 'Untitled Product', font, nameSize, nameWidth);
        const metaRuns: Entry['metaRuns'] = [];
        const vendor = ascii(row.vendorBrand);
        const sku = ascii(row.sku);
        const domain = domainOf(row.url);
        if (vendor) metaRuns.push({ text: vendor });
        if (sku) metaRuns.push({ text: sku });
        if (domain) metaRuns.push({ text: domain, link: row.url });

        const priceNum = parsePrice(row.price);
        const priceStr = priceNum != null ? formatCurrency(priceNum) : 'Price on request';

        const qtyNum = parseQty(row.quantity);
        const qtyStr = qtyNum != null ? `${qtyNum} ${ascii(row.unit) || 'ea'}` : '';

        const tradeNum = includePricing ? parsePrice(row.tradePricing) : null;
        const tradeStr = tradeNum != null ? `Trade ${formatCurrency(tradeNum)}` : '';

        let leadStr = '';
        if (includeLeadTime) {
          const bits: string[] = [];
          if (row.leadTime) bits.push(ascii(row.leadTime));
          if (row.availability) bits.push(ascii(row.availability));
          leadStr = bits.join(' · ');
        }

        const notesLines = row.notes ? wrap(row.notes, font, metaSize, nameWidth) : [];
        return { nameLines, metaRuns, notesLines, priceStr, priceNum, qtyStr, tradeStr, leadStr };
      };

      const measureEntry = (e: Entry): number => {
        const leftH =
          e.nameLines.length * nameLH +
          (e.metaRuns.length ? metaLH : 0) +
          e.notesLines.length * metaLH;
        let railLines = 1; // price always
        if (e.qtyStr) railLines += 1;
        if (e.tradeStr) railLines += 1;
        if (e.leadStr) railLines += 1;
        const rightH = priceLH + (railLines - 1) * railLH;
        return Math.max(leftH, rightH) + entryGap;
      };

      // --- page state ------------------------------------------------------
      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight; // pen position, measured from the page bottom

      const drawRunningHeader = () => {
        const hy = pageHeight - 44;
        page.drawText(titleText, { x: marginX, y: hy, size: 11, font: titleFont, color: ink });
        const eyebrow = 'S P E C I F I C A T I O N';
        const ew = fontBold.widthOfTextAtSize(eyebrow, 8);
        page.drawText(eyebrow, { x: pageWidth - marginX - ew, y: hy, size: 8, font: fontBold, color: taupe });
        const ry = hy - 9;
        page.drawLine({ start: { x: marginX, y: ry }, end: { x: pageWidth - marginX, y: ry }, thickness: 0.75, color: gold });
        y = ry - 22;
      };

      const drawDocumentHeader = () => {
        const bandH = 92;
        page.drawRectangle({ x: 0, y: pageHeight - bandH, width: pageWidth, height: bandH, color: warm });
        const eyebrow = 'S P E C I F I C A T I O N';
        page.drawText(eyebrow, { x: marginX, y: pageHeight - 36, size: 9, font: fontBold, color: taupe });
        page.drawText(titleText, { x: marginX, y: pageHeight - 66, size: 24, font: titleFont, color: ink });
        const metaLines = [
          `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
          `${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`,
          `Generated ${genDate}`,
        ];
        let my = pageHeight - 36;
        for (const ln of metaLines) {
          const w = font.widthOfTextAtSize(ln, 9);
          page.drawText(ln, { x: pageWidth - marginX - w, y: my, size: 9, font, color: taupe });
          my -= 13;
        }
        const ry = pageHeight - bandH;
        page.drawLine({ start: { x: marginX, y: ry }, end: { x: pageWidth - marginX, y: ry }, thickness: 1, color: gold });
        y = ry - 26;
      };

      const newPage = () => {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        drawRunningHeader();
      };

      // Reserve space; start a fresh page if `needed` points won't fit.
      const ensureSpace = (needed: number) => {
        if (y - needed < bottomLimit) newPage();
      };

      const drawRoomHeader = (roomName: string) => {
        page.drawText(ascii(roomName).toUpperCase(), { x: marginX, y: y - roomLabelSize, size: roomLabelSize, font: fontBold, color: gold });
        const ry = y - roomLabelSize - 6;
        page.drawLine({ start: { x: marginX, y: ry }, end: { x: pageWidth - marginX, y: ry }, thickness: 0.75, color: gold });
        y = ry - 14;
      };
      const roomHeaderHeight = roomLabelSize + 6 + 14;

      const drawRight = (text: string, baseline: number, size: number, f: typeof font, color: typeof ink) => {
        const w = f.widthOfTextAtSize(text, size);
        page.drawText(text, { x: railRight - w, y: baseline, size, font: f, color });
      };

      const drawEntry = (e: Entry) => {
        const top = y;
        // Left column: wrapped name, then meta runs, then notes.
        let ly = top;
        for (const line of e.nameLines) {
          page.drawText(line, { x: marginX, y: ly - nameSize, size: nameSize, font, color: ink });
          ly -= nameLH;
        }
        if (e.metaRuns.length) {
          const baseline = ly - metaSize;
          let mx = marginX;
          const sep = ' · ';
          e.metaRuns.forEach((run, i) => {
            if (i > 0) {
              page.drawText(sep, { x: mx, y: baseline, size: metaSize, font, color: taupe });
              mx += font.widthOfTextAtSize(sep, metaSize);
            }
            page.drawText(run.text, { x: mx, y: baseline, size: metaSize, font, color: taupe });
            const w = font.widthOfTextAtSize(run.text, metaSize);
            if (run.link) addLink(page, mx, baseline, w, metaSize, run.link);
            mx += w;
          });
          ly -= metaLH;
        }
        for (const line of e.notesLines) {
          page.drawText(line, { x: marginX, y: ly - metaSize, size: metaSize, font, color: taupe });
          ly -= metaLH;
        }

        // Right rail: price, optional qty, optional trade, optional lead/avail.
        let ry = top;
        drawRight(e.priceStr, ry - priceSize, priceSize, fontBold, ink);
        ry -= priceLH;
        if (e.qtyStr) { drawRight(e.qtyStr, ry - railSize, railSize, font, taupe); ry -= railLH; }
        if (e.tradeStr) { drawRight(e.tradeStr, ry - railSize, railSize, font, taupe); ry -= railLH; }
        if (e.leadStr) { drawRight(e.leadStr, ry - railSize, railSize, font, taupe); ry -= railLH; }

        const bottom = Math.min(ly, ry);
        y = bottom - entryGap;
      };

      const footerNoteText =
        'Pricing shown is per listing. Some items are priced per unit, per square foot or linear foot, where the listed price is a rate rather than a line cost. Request vendor quotes for material takeoffs and final pricing.';

      // Draw the closing note once, at the very end of the document. product.price
      // is unitless: a per-each cost (a chandelier) and a per-SF rate (a slab)
      // share the field, so any sum across items would mix units and mislead on a
      // client-facing quote. We keep every per-item price as displayed reference
      // and replace the former room subtotals / project total with this note.
      // See docs/17a_SPEC_SHEET_TOTALS_DELTA.md.
      const drawFooterNote = (unpriced: number) => {
        const noteLines = wrap(footerNoteText, font, metaSize, contentWidth);
        const blockH = noteLines.length * metaLH + (unpriced > 0 ? metaLH : 0) + 16;
        ensureSpace(blockH);
        y -= 16; // separate the note from the last entry
        for (const line of noteLines) {
          page.drawText(line, { x: marginX, y: y - metaSize, size: metaSize, font, color: taupe });
          y -= metaLH;
        }
        if (unpriced > 0) {
          const count = `${unpriced} ${unpriced === 1 ? 'item' : 'items'} priced on request`;
          page.drawText(count, { x: marginX, y: y - metaSize, size: metaSize, font, color: taupe });
          y -= metaLH;
        }
      };

      // --- build the document ---------------------------------------------
      drawDocumentHeader();

      if (exportData.length === 0) {
        page.drawText('No products tagged in this project yet.', { x: marginX, y: y - metaSize, size: 11, font, color: taupe });
      } else {
        let currentRoom: string | null = null;
        let projectUnpriced = 0;

        for (const row of exportData) {
          const entry = buildEntry(row);
          const entryH = measureEntry(entry);

          if (row.room !== currentRoom) {
            // Keep the room label with its first entry so it never strands.
            ensureSpace(roomHeaderHeight + entryH);
            drawRoomHeader(row.room);
            currentRoom = row.room;
          } else {
            ensureSpace(entryH);
          }

          drawEntry(entry);
          if (entry.priceNum == null) projectUnpriced += 1;
        }

        // No summed totals: per-item prices mix units, so a sum would be
        // dishonest. Render the closing note (plus an unpriced count if any).
        drawFooterNote(projectUnpriced);
      }

      // Second pass: now that the page count is known, stamp "Page i of N".
      const pages = pdfDoc.getPages();
      const pageTotal = pages.length;
      pages.forEach((p, i) => {
        const label = `Page ${i + 1} of ${pageTotal}`;
        const w = font.widthOfTextAtSize(label, 8);
        p.drawText(label, { x: pageWidth - marginX - w, y: 34, size: 8, font, color: taupe });
      });

      const pdfBytes = await pdfDoc.save();

      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to export spec' },
      { status: 500 }
    );
  }
}

