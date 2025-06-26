import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category');
    const vendor = searchParams.get('vendor');
    const limit = searchParams.get('limit');

    // Load products from JSON file
    const productsPath = join(process.cwd(), 'data', 'products2.json');
    const productsContent = await readFile(productsPath, 'utf-8');
    const productsData = JSON.parse(productsContent);

    let filteredProducts = productsData;

    // Apply search filter
    if (search) {
      filteredProducts = filteredProducts.filter((product: any) =>
        product.name.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search) ||
        product.vendor.toLowerCase().includes(search) ||
        product.category.toLowerCase().includes(search)
      );
    }

    // Apply category filter
    if (category) {
      filteredProducts = filteredProducts.filter((product: any) =>
        product.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Apply vendor filter
    if (vendor) {
      filteredProducts = filteredProducts.filter((product: any) =>
        product.vendor.toLowerCase() === vendor.toLowerCase()
      );
    }

    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit, 10);
      filteredProducts = filteredProducts.slice(0, limitNum);
    }

    return NextResponse.json({
      success: true,
      products: filteredProducts,
      total: filteredProducts.length
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
} 