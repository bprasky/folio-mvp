import { NextRequest, NextResponse } from 'next/server';
import { SmartImageSearch } from '@/lib/imageSearch';

export async function POST(request: NextRequest) {
  try {
    const { type, name, description, location, category, brand } = await request.json();

    if (!type || !name) {
      return NextResponse.json(
        { error: 'Type and name are required' },
        { status: 400 }
      );
    }

    const context = {
      type: type as 'event' | 'vendor' | 'product' | 'location',
      name,
      description,
      location,
      category,
      brand
    };

    console.log('🔍 Smart image search request:', context);

    const images = await SmartImageSearch.searchImages(context);

    return NextResponse.json({
      success: true,
      images,
      query: SmartImageSearch['buildSearchQuery'](context)
    });

  } catch (error) {
    console.error('Smart image search error:', error);
    return NextResponse.json(
      { error: 'Failed to search images' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const name = searchParams.get('name');
    const description = searchParams.get('description');
    const location = searchParams.get('location');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');

    if (!type || !name) {
      return NextResponse.json(
        { error: 'Type and name are required' },
        { status: 400 }
      );
    }

    const context = {
      type: type as 'event' | 'vendor' | 'product' | 'location',
      name,
      description: description || undefined,
      location: location || undefined,
      category: category || undefined,
      brand: brand || undefined
    };

    console.log('🔍 Smart image search request:', context);

    const images = await SmartImageSearch.searchImages(context);

    return NextResponse.json({
      success: true,
      images,
      query: SmartImageSearch['buildSearchQuery'](context)
    });

  } catch (error) {
    console.error('Smart image search error:', error);
    return NextResponse.json(
      { error: 'Failed to search images' },
      { status: 500 }
    );
  }
} 