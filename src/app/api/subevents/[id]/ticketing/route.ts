import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PATCH /api/subevents/[id]/ticketing
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { ticketingType } = await req.json();
  const subEvent = await prisma.subEvent.update({
    where: { id: params.id },
    data: { ticketingType },
  });
  return NextResponse.json(subEvent);
} 