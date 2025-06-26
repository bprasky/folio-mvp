import { NextRequest, NextResponse } from 'next/server';

// This would normally import from a shared module or database
// For demo purposes, we'll use a simple approach
let productTags: Array<{
  id: string;
  x: number;
  y: number;
  imageUrl: string;
  productId: string;
  projectId: string;
  createdAt: string;
}> = [];

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tagId = params.id;

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Find the tag index
    const tagIndex = productTags.findIndex(tag => tag.id === tagId);

    if (tagIndex === -1) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Remove the tag
    const deletedTag = productTags.splice(tagIndex, 1)[0];

    console.log('Product tag deleted:', deletedTag);

    return NextResponse.json({ 
      success: true, 
      deletedTag 
    });

  } catch (error) {
    console.error('Failed to delete product tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete product tag' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tagId = params.id;

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Find the tag
    const tag = productTags.find(tag => tag.id === tagId);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(tag);

  } catch (error) {
    console.error('Failed to fetch product tag:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product tag' },
      { status: 500 }
    );
  }
} 