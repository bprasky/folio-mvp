import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const DEV_ONLY = process.env.NODE_ENV !== 'production';

export async function POST(req: Request) {
  if (!DEV_ONLY) return NextResponse.json({ error: 'disabled in prod' }, { status: 403 });

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });

  const normalized = String(email).trim().toLowerCase();

  // Case-insensitive lookup to diagnose casing issues.
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true, email: true, role: true, passwordHash: true },
  });

  if (!user) return NextResponse.json({ found: false });

  const hasHash = !!user.passwordHash;
  let compareOk = false;
  if (hasHash) {
    try { compareOk = await bcrypt.compare(String(password), user.passwordHash!); } catch {}
  }

  return NextResponse.json({
    found: true,
    emailStored: user.email,
    role: user.role,
    hasHash,
    compareOk,
  });
}
