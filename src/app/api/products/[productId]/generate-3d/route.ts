export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { callSam3DService } from '@/lib/three-d/sam3d-client';
import { uploadGeneratedMesh } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        threeDAssetUrl: true,
        vendorId: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Auth: admin or product vendor
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN' && product.vendorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Already has a mesh — return it
    if (product.threeDAssetUrl) {
      return NextResponse.json({
        status: 'already_exists',
        meshUrl: product.threeDAssetUrl,
      });
    }

    if (!product.imageUrl) {
      return NextResponse.json(
        { error: 'Product has no image to generate mesh from' },
        { status: 400 }
      );
    }

    // Parse optional prompt from body
    const body = await request.json().catch(() => ({}));

    // Call SAM 3D service (currently stubbed — will throw until configured)
    const meshResult = await callSam3DService({
      imageUrl: product.imageUrl,
      productId: product.id,
      prompt: body.prompt,
    });

    // Upload .glb to Supabase Storage
    const uploadResult = await uploadGeneratedMesh({
      projectId: 'standalone',
      productId: product.id,
      buffer: meshResult.glbBuffer,
      mime: 'model/gltf-binary',
    });

    // Persist URL on product
    await prisma.product.update({
      where: { id: product.id },
      data: { threeDAssetUrl: uploadResult.publicUrl },
    });

    return NextResponse.json({
      status: 'success',
      meshUrl: uploadResult.publicUrl,
    });
  } catch (error: any) {
    console.error('[generate-3d] Error:', {
      productId: params.productId,
      error: error.message,
    });

    return NextResponse.json(
      {
        status: 'failed',
        error: error.message || 'Unknown error',
      },
      { status: 200 } // Soft failure
    );
  }
}
