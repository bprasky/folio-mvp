import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
// In production, this would be stored in a database
let productTags: Array<{
  id: string;
  x: number;
  y: number;
  imageUrl: string;
  productId: string;
  projectId: string;
  createdAt: string;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const { x, y, imageUrl, productId, projectId } = await request.json();

    // Validate required fields
    if (!x || !y || !imageUrl || !productId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: x, y, imageUrl, productId, projectId' },
        { status: 400 }
      );
    }

    // Create new tag
    const newTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: parseFloat(x),
      y: parseFloat(y),
      imageUrl,
      productId,
      projectId,
      createdAt: new Date().toISOString()
    };

    // Store the tag (in production, this would be saved to database)
    productTags.push(newTag);

    console.log('Product tag created:', newTag);

    return NextResponse.json({ 
      success: true, 
      id: newTag.id,
      tag: newTag 
    });

  } catch (error) {
    console.error('Failed to create product tag:', error);
    return NextResponse.json(
      { error: 'Failed to create product tag' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const imageUrl = searchParams.get('imageUrl');

    let filteredTags = productTags;

    // Filter by projectId if provided
    if (projectId) {
      filteredTags = filteredTags.filter(tag => tag.projectId === projectId);
    }

    // Filter by imageUrl if provided
    if (imageUrl) {
      filteredTags = filteredTags.filter(tag => tag.imageUrl === imageUrl);
    }

    return NextResponse.json(filteredTags);

  } catch (error) {
    console.error('Failed to fetch product tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product tags' },
      { status: 500 }
    );
  }
} 