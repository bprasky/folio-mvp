import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category');
    const vendor = searchParams.get('vendor');
    const limit = searchParams.get('limit');

    // Build where clause for database query
    const whereClause: any = {};

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Apply category filter
    if (category) {
      whereClause.category = { equals: category, mode: 'insensitive' };
    }

    // Apply vendor filter
    if (vendor) {
      whereClause.vendor = {
        name: { contains: vendor, mode: 'insensitive' }
      };
    }

    // Load products from database
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      },
      take: limit ? parseInt(limit, 10) : undefined,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data to match expected format
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.imageUrl,
      category: product.category,
      brand: product.brand,
      vendor: product.vendor?.name || product.vendor?.companyName || product.brand,
      url: product.url,
      isPending: product.isPending
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, imageUrl, price, brand, category, url, isPending, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Create product in database
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description || null,
        imageUrl: imageUrl || null,
        price: price ? parseFloat(String(price)) : null,
        brand: brand || null,
        category: category || null,
        url: url || null,
        isPending: isPending ?? false,
        vendorId: null, // Can be set later if needed
      },
    });

    return NextResponse.json({
      success: true,
      id: product.id,
      product,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
} 