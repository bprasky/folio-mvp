import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const roomId = formData.get('roomId') as string | null;
    const selectionId = formData.get('selectionId') as string | null;
    const notes = formData.get('notes') as string | null;
    const totalAmount = formData.get('totalAmount') as string | null;
    const file = formData.get('file') as File | null;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    let quoteUrl = '';
    let quoteFileName = '';
    
    if (file) {
      // Upload file to storage (using existing video upload endpoint for now)
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/videos/upload`, {
        method: 'POST',
        body: uploadFormData,
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        quoteUrl = uploadData.url;
        quoteFileName = file.name;
      }
    }

    // For now, we'll need a vendorRepId - this should come from the authenticated user
    // For demo purposes, we'll use a placeholder
    const vendorRepId = 'demo-vendor-rep-id';

    const quote = await prisma.quote.create({
      data: {
        projectId,
        roomId: roomId || null,
        selectionId: selectionId || null,
        quoteUrl,
        quoteFileName: quoteFileName || null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        notes: notes || null,
        vendorRepId,
      },
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    );
  }
} 