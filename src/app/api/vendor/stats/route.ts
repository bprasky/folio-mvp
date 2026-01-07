import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best effort: read visit tokens by this vendor user
  try {
    const [sent, opened, selected] = await Promise.all([
      prisma.vendorVisit.count({ where: { vendorId: session.user.id } }),
      prisma.vendorVisit.count({ where: { vendorId: session.user.id, projectId: { not: null } } }), // Use projectId for "opened"
      prisma.vendorVisit.count({ where: { vendorId: session.user.id, projectId: { not: null } } }),
    ]);
    return NextResponse.json({ sent, opened, selected });
  } catch {
    // If the fields don't exist or there are other issues, return zeros
    return NextResponse.json({ sent: 0, opened: 0, selected: 0 });
  }
}
