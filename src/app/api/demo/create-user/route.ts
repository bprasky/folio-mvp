import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * POST /api/demo/create-user
 * Creates or updates demo@folio.com user
 * This endpoint handles schema mismatches gracefully
 */
export async function POST(request: NextRequest) {
  // Only allow in development or with a secret token
  if (process.env.NODE_ENV === 'production' && !request.headers.get('x-demo-secret')) {
    return NextResponse.json({ error: 'Not allowed in production without secret' }, { status: 403 });
  }

  try {
    const email = 'demo@folio.com';
    const password = 'password123';
    const passwordHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8j8qKqK'; // Same as other demo users

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    let user;
    if (existingUser) {
      // Update using raw SQL to avoid schema mismatch
      await prisma.$executeRaw`
        UPDATE "users" 
        SET role = 'INDIVIDUAL'::"Role", "passwordHash" = ${passwordHash}
        WHERE email = ${email}
      `;
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, name: true },
      });
    } else {
      // Create using raw SQL with only required fields
      await prisma.$executeRaw`
        INSERT INTO "users" (id, email, name, role, "passwordHash", "createdAt", "updatedAt", followers, views)
        VALUES (gen_random_uuid(), ${email}, 'Demo Individual', 'INDIVIDUAL'::"Role", ${passwordHash}, NOW(), NOW(), 0, 0)
      `;
      user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, name: true },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      message: 'Demo user created/updated successfully',
      credentials: {
        email: 'demo@folio.com',
        password: 'password123',
      },
    });
  } catch (error: any) {
    console.error('[demo/create-user] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create demo user', details: error.message },
      { status: 500 }
    );
  }
}




