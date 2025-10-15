import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    // Get current user
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ recaps: [] });
    }

    // Get user's saved products for this event
    // This is a placeholder - you'll need to implement the actual logic
    // based on how products are saved to projects in your schema
    const savedProducts = await prisma.product.findMany({
      where: {
        // Add your saved products logic here
        // For now, returning empty array to prevent crashes
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
      take: 8,
    });

    // Transform to match the UserEventRecap interface
    const recaps = savedProducts.map((product, index) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      vendor: product.vendor!,
      project: {
        id: `project-${index + 1}`, // Placeholder
        name: `Project ${index + 1}`, // Placeholder
      },
      savedAt: new Date(), // Placeholder
    }));

    return NextResponse.json({
      recaps: recaps,
    });
  } catch (error) {
    console.error('Error fetching user recap:', error);
    return NextResponse.json(
      { recaps: [] },
      { status: 500 }
    );
  }
}
