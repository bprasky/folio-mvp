import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/invites/[token]
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const invite = await prisma.subEventInvite.findUnique({
    where: { inviteToken: params.token },
  });
  if (!invite) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, invite });
} 