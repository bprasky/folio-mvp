import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Fetch project with rooms and selections
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
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
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Generate spec sheet content
    let specSheetContent = `PROJECT SPECIFICATION SHEET
Generated on: ${new Date().toLocaleDateString()}
Project: ${project.name}
Project ID: ${project.id}
${project.description ? `Description: ${project.description}` : ''}

================================================================================

`;

    // Add room-by-room selections
    for (const room of project.rooms) {
      specSheetContent += `ROOM: ${room.name}
${'='.repeat(50)}

`;
      
      if (room.selections.length === 0) {
        specSheetContent += `No selections in this room.\n\n`;
        continue;
      }

      for (const selection of room.selections) {
        specSheetContent += `Product: ${selection.productName || 'Unnamed Product'}
`;
        
        if (selection.vendorName) {
          specSheetContent += `Vendor: ${selection.vendorName}
`;
        }
        
        if (selection.colorFinish) {
          specSheetContent += `Color/Finish: ${selection.colorFinish}
`;
        }
        
        if (selection.unitPrice) {
          specSheetContent += `Unit Price: $${selection.unitPrice}`;
          if (selection.quantity && selection.quantity > 1) {
            const totalPrice = Number(selection.unitPrice) * selection.quantity;
            specSheetContent += ` × ${selection.quantity} = $${totalPrice.toFixed(2)}`;
          }
          specSheetContent += '\n';
        }
        
        if (selection.notes) {
          specSheetContent += `Notes: ${selection.notes}
`;
        }
        
        // TODO: Add spec sheet references once Prisma client is regenerated
        // if (selection.specSheetUrl) {
        //   specSheetContent += `Spec Sheet: ${selection.specSheetFileName || 'Uploaded Spec Sheet'} (${selection.specSheetUrl})
        // `;
        // }
        
        specSheetContent += '\n';
      }
      
      specSheetContent += '\n';
    }

    specSheetContent += `================================================================================
END OF SPECIFICATION SHEET

Note: This is a text-based export. For a more comprehensive PDF export with 
embedded spec sheets and better formatting, please contact support.`;

    // Create a blob with the content
    const blob = new Blob([specSheetContent], { type: 'text/plain' });
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-spec-sheet.txt"`
      }
    });
  } catch (error) {
    console.error('Error generating spec sheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate spec sheet' },
      { status: 500 }
    );
  }
} 