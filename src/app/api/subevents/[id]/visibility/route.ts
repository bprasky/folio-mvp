import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH /api/subevents/[id]/visibility
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { visibility } = await req.json();
  const subEvent = await prisma.subEvent.update({
    where: { id: params.id },
    data: { visibility },
  });
  return NextResponse.json(subEvent);
} 