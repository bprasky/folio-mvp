export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
import ExcelJS from 'exceljs';
import { getRoomTemplate, getRoomTemplateByType } from '@/app/project/[id]/roomTemplates';

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

    // Fetch project with rooms and selections
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        rooms: {
          include: {
            selections: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
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

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Filter rooms based on scope
    let roomsToExport = project.rooms;
    if (scope === 'current' && roomId) {
      roomsToExport = project.rooms.filter(r => r.id === roomId);
    }

    // Build export data - only items on boards (selections with slotKey or in rooms)
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

    for (const room of roomsToExport) {
      const roomTemplate = room.type
        ? getRoomTemplateByType(room.type)
        : getRoomTemplate(room.name);

      for (const selection of room.selections) {
        let boardSection = 'General';
        if (selection.slotKey && roomTemplate) {
          const slot = roomTemplate.slots.find(s => s.key === selection.slotKey);
          boardSection = slot?.label || selection.slotKey;
        } else if (selection.tags && selection.tags.length > 0) {
          boardSection = selection.tags[0];
        }

        // Look up pricing from ProjectProductPricing
        const productId = selection.vendorProductId || selection.id;
        const pricingKey = `${productId}-${room.id}`;
        const pricingKeyNoRoom = `${productId}-`;
        const pricing = pricingMap.get(pricingKey) || pricingMap.get(pricingKeyNoRoom);

        exportData.push({
          projectName: project.title || 'Untitled Project',
          room: room.name,
          boardSection,
          productName: selection.productName || 'Untitled Product',
          vendorBrand: selection.vendorName || '',
          sku: selection.vendorProductId || '',
          url: selection.productUrl || '',
          price: selection.unitPrice ? `$${Number(selection.unitPrice).toFixed(2)}` : '',
          tradePricing: pricing?.unitPriceTrade ? `$${pricing.unitPriceTrade.toFixed(2)}` : '',
          leadTime: pricing?.leadTimeWeeks ? `${pricing.leadTimeWeeks} wk` : '',
          availability: pricing?.availability || '',
          unit: 'ea',
          quantity: selection.quantity ? String(selection.quantity) : '',
          notes: selection.notes || ''
        });
      }
    }

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
      // (no Helvetica.afm ENOENT). StandardFonts use WinAnsi encoding, so we
      // sanitize cell text to ASCII to avoid "cannot encode" errors on stray
      // unicode (smart quotes, em dashes) in product/vendor names.
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const pageWidth = 612; // US Letter, points
      const pageHeight = 792;
      const marginX = 50;
      const black = rgb(0, 0, 0);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const headers = ['Project', 'Room', 'Section', 'Product', 'Vendor', 'SKU', 'URL', 'Price', 'Unit', 'Qty', 'Notes'];
      // Widths sum to 512 (= pageWidth - 2*marginX) so the table fits the page.
      const colWidths = [55, 40, 45, 80, 50, 45, 75, 32, 22, 22, 46];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);

      // Replace common typographic chars, then drop anything outside printable
      // ASCII so StandardFonts can always encode it.
      const ascii = (text: unknown): string =>
        (text ?? '')
          .toString()
          .replace(/[‘’]/g, "'")
          .replace(/[“”]/g, '"')
          .replace(/[–—]/g, '-')
          .replace(/…/g, '...')
          .replace(/ /g, ' ')
          .replace(/[^\x20-\x7E]/g, '');

      // Trim a cell to fit its column width, adding an ellipsis when truncated.
      const fit = (text: unknown, f: typeof font, size: number, maxWidth: number): string => {
        let t = ascii(text);
        if (!t || f.widthOfTextAtSize(t, size) <= maxWidth) return t;
        while (t.length > 1 && f.widthOfTextAtSize(t + '...', size) > maxWidth) {
          t = t.slice(0, -1);
        }
        return t + '...';
      };

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let cursor = 50; // distance from top of page

      const drawRow = (values: unknown[], f: typeof font, size: number) => {
        let x = marginX;
        values.forEach((value, i) => {
          page.drawText(fit(value, f, size, colWidths[i] - 4), {
            x: x + 2,
            y: pageHeight - cursor - size,
            size,
            font: f,
            color: black,
          });
          x += colWidths[i];
        });
      };

      // Title (centered)
      const title = ascii(project.title || 'Project Specification');
      const titleSize = 20;
      page.drawText(title, {
        x: (pageWidth - fontBold.widthOfTextAtSize(title, titleSize)) / 2,
        y: pageHeight - cursor - titleSize,
        size: titleSize,
        font: fontBold,
        color: black,
      });
      cursor += titleSize + 10;

      const genText = ascii(`Generated: ${new Date().toLocaleDateString()}`);
      const genSize = 11;
      page.drawText(genText, {
        x: (pageWidth - font.widthOfTextAtSize(genText, genSize)) / 2,
        y: pageHeight - cursor - genSize,
        size: genSize,
        font,
        color: black,
      });
      cursor += genSize + 24;

      // Header row + underline
      const headerSize = 9;
      drawRow(headers, fontBold, headerSize);
      cursor += headerSize + 4;
      page.drawLine({
        start: { x: marginX, y: pageHeight - cursor },
        end: { x: marginX + tableWidth, y: pageHeight - cursor },
        thickness: 0.5,
        color: black,
      });
      cursor += 6;

      // Data rows
      const rowSize = 8;
      const rowHeight = 14;
      for (const row of exportData) {
        if (cursor + rowHeight > pageHeight - marginX) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          cursor = marginX;
        }
        drawRow(
          [
            row.projectName,
            row.room,
            row.boardSection,
            row.productName,
            row.vendorBrand,
            row.sku,
            row.url,
            row.price,
            row.unit,
            row.quantity,
            row.notes,
          ],
          font,
          rowSize,
        );
        cursor += rowHeight;
      }

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

