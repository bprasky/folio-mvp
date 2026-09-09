export const dynamic = 'force-dynamic';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vendorClaimMembership } from '@/lib/vendor/claimAuthorization';
import { z } from 'zod';

const schema = z.object({
  productId: z.string().uuid(),
  projectId: z.string().uuid(),
  requestedDesignerId: z.string().uuid().optional(),
  message: z.string().trim().max(2000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

class RequestFailure extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'VENDOR') return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request context' }, { status: 400 });
  const input = parsed.data;
  try {
    const boost = await prisma.$transaction(async tx => {
      // Same qualifying membership policy as canonical vendor catalog creation.
      if (!await vendorClaimMembership(session.user.id, undefined, tx)) {
        throw new RequestFailure('Active vendor organization membership required', 403);
      }
      const product = await tx.product.findUnique({
        where: { id: input.productId }, select: { id: true, vendorId: true },
      });
      if (!product || product.vendorId !== session.user.id) {
        throw new RequestFailure('Product ownership required', 403);
      }
      const project = await tx.project.findUnique({
        where: { id: input.projectId }, select: { id: true, ownerId: true, designerId: true },
      });
      if (!project) throw new RequestFailure('Project not found', 404);
      const designerId = input.requestedDesignerId ?? project.designerId ?? project.ownerId;
      if (!designerId || (designerId !== project.designerId && designerId !== project.ownerId)
        || !await tx.user.findFirst({ where: { id: designerId, role: 'DESIGNER' }, select: { id: true } })) {
        throw new RequestFailure('Requested designer must own or design this project', 400);
      }
      const tag = await tx.productTag.findFirst({
        where: { productId: product.id, image: { projectId: project.id } }, select: { id: true },
      });
      if (!tag) throw new RequestFailure('Product must be tagged in the referenced project', 400);
      const now = new Date();
      const existing = await tx.vendorBoostRequest.findFirst({
        where: {
          productId: product.id, projectId: project.id, requestedDesignerId: designerId,
          OR: [{ status: 'ACCEPTED' }, { status: 'PENDING', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        }, select: { id: true },
      });
      if (existing) throw new RequestFailure('An active request already exists', 409);
      return tx.vendorBoostRequest.create({
        data: {
          id: randomUUID(), vendorId: session.user.id, productId: product.id,
          projectId: project.id, requestedDesignerId: designerId,
          message: input.message || null, expiresAt: new Date(now.getTime() + input.expiresInDays * 86400000),
          status: 'PENDING', requestedAt: now, updatedAt: now,
        },
        select: { id: true, status: true, requestedAt: true, expiresAt: true },
      });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ ok: true, vendorBoostRequest: boost });
  } catch (error) {
    if (error instanceof RequestFailure) return NextResponse.json({ error: error.message }, { status: error.status });
    // Includes a serializable conflict: refresh/retry; no partially persisted request.
    return NextResponse.json({ error: 'Request could not be saved. Refresh before retrying.' }, { status: 409 });
  }
}

