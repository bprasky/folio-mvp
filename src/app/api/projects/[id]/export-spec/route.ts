import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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

    // Check edit permissions
    const access = await assertProjectView(session.user.id, projectId);
    if (!['OWNER', 'EDITOR'].includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      unit: string;
      quantity: string;
      notes: string;
    }> = [];

    for (const room of roomsToExport) {
      const roomTemplate = room.type 
        ? getRoomTemplateByType(room.type) 
        : getRoomTemplate(room.name);
      
      for (const selection of room.selections) {
        // Get board section from slotKey or infer from category
        let boardSection = 'General';
        if (selection.slotKey && roomTemplate) {
          const slot = roomTemplate.slots.find(s => s.key === selection.slotKey);
          boardSection = slot?.label || selection.slotKey;
        } else if (selection.tags && selection.tags.length > 0) {
          // Infer from first tag
          boardSection = selection.tags[0];
        }

        exportData.push({
          projectName: project.title || 'Untitled Project',
          room: room.name,
          boardSection,
          productName: selection.productName || 'Untitled Product',
          vendorBrand: selection.vendorName || '',
          sku: selection.vendorProductId || '',
          url: selection.productUrl || '',
          price: selection.unitPrice ? `$${Number(selection.unitPrice).toFixed(2)}` : '',
          unit: 'ea', // Default unit
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
      worksheet.columns = [
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
        { header: 'Notes', key: 'notes', width: 40 }
      ];

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
      // Generate PDF
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {});

      // Header
      doc.fontSize(20).text(project.title || 'Project Specification', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Table headers
      const tableTop = doc.y;
      const rowHeight = 20;
      const colWidths = [80, 60, 70, 100, 70, 60, 120, 50, 40, 50, 100];
      const headers = ['Project', 'Room', 'Section', 'Product', 'Vendor', 'SKU', 'URL', 'Price', 'Unit', 'Qty', 'Notes'];

      doc.fontSize(10).font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });

      // Draw header underline
      doc.moveTo(50, tableTop + rowHeight).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + rowHeight).stroke();

      // Table rows
      doc.font('Helvetica').fontSize(8);
      let y = tableTop + rowHeight + 5;
      
      exportData.forEach((row, idx) => {
        if (y > 750) { // New page if needed
          doc.addPage();
          y = 50;
        }

        x = 50;
        const values = [
          row.projectName.substring(0, 15),
          row.room.substring(0, 12),
          row.boardSection.substring(0, 15),
          row.productName.substring(0, 20),
          row.vendorBrand.substring(0, 12),
          row.sku.substring(0, 10),
          row.url.substring(0, 25),
          row.price,
          row.unit,
          row.quantity,
          row.notes.substring(0, 25)
        ];

        values.forEach((value, i) => {
          doc.text(value || '', x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });

        y += rowHeight;
      });

      doc.end();

      // Wait for PDF to finish
      await new Promise<void>((resolve) => {
        doc.on('end', resolve);
      });

      const pdfBuffer = Buffer.concat(chunks);

      return new NextResponse(pdfBuffer, {
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

