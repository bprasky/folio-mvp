export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { logSignal, extractTags } from '@/lib/telemetry/context-signal';

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Transform to match expected format
    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      priceCents: product.price ? Math.round(Number(product.price) * 100) : null,
      imageUrl: product.imageUrl,
      category: product.category,
      brand: product.brand,
      vendorName: product.vendor?.name || product.vendor?.companyName || product.brand,
      url: product.url,
      currency: 'USD' // Default currency
    };

    // Log context signal for product view (async, non-blocking)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      logSignal({
        userId: session.user.id,
        productId: product.id,
        vendorId: product.vendorId || undefined,
        action: 'view',
        tags: extractTags(product),
      }).catch(err => console.error('[ContextSignal] Failed to log view:', err));
    }

    return NextResponse.json(formattedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      priceCents,
      imageUrl,
      brand,
      url,
      vendorName,
      currency = 'USD'
    } = body;

    // Convert priceCents back to decimal
    const price = priceCents ? priceCents / 100 : null;

    // Find vendor by name (vendor is a User with role VENDOR)
    let vendorId: string | undefined;
    if (vendorName) {
      const vendor = await prisma.user.findFirst({
        where: {
          role: 'VENDOR',
          OR: [
            { name: { equals: vendorName, mode: 'insensitive' } },
            { companyName: { equals: vendorName, mode: 'insensitive' } }
          ]
        }
      });
      vendorId = vendor?.id;
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: params.productId },
      data: {
        name,
        description,
        price,
        imageUrl,
        brand,
        url,
        vendorId: vendorId
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    // Transform response
    const formattedProduct = {
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: updatedProduct.price,
      imageUrl: updatedProduct.imageUrl,
      brand: updatedProduct.brand,
      url: updatedProduct.url,
      vendorName: updatedProduct.vendor?.name || updatedProduct.vendor?.companyName || updatedProduct.brand
    };

    return NextResponse.json({
      success: true,
      product: formattedProduct
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

