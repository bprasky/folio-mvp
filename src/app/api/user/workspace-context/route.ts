import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const operatingAsOrgId = body?.operatingAsOrgId;
    if (operatingAsOrgId !== null && (typeof operatingAsOrgId !== 'string' || !operatingAsOrgId)) {
      return NextResponse.json({ error: 'Choose a firm or your personal account.' }, { status: 400 });
    }
    const membership = operatingAsOrgId ? await prisma.organizationUser.findFirst({
      where: { userId: session.user.id, organizationId: operatingAsOrgId, isActive: true },
      select: { organization: { select: { id: true, name: true, type: true, logo: true } } },
    }) : null;
    if (operatingAsOrgId && !membership) return NextResponse.json({ error: 'You do not have active access to this firm.' }, { status: 403 });
    const now = new Date();
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        operatingAsOrgId,
        ...(membership ? { onboardingDiagnosticAt: now, onboardingFirmContextAt: now, onboardingBioCaptureAt: now, onboardingProfilePreviewAt: now } : {}),
      },
    });
    return NextResponse.json({ success: true, user: { id: session.user.id, operatingAsOrgId, operatingAsOrg: membership?.organization ?? null } });
  } catch (error) {
    console.error('[workspace] Could not change workspace:', error);
    return NextResponse.json({ error: 'Could not change workspace. Please try again.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const [user, memberships] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, profileImage: true, operatingAsOrgId: true } }),
      prisma.organizationUser.findMany({
        where: { userId: session.user.id, isActive: true },
        select: { role: true, organization: { select: { id: true, name: true, type: true, logo: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
    ]);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const organizations = memberships.map(({ role, organization }) => ({ ...organization, userRole: role }));
    const operatingAsOrg = organizations.find((org) => org.id === user.operatingAsOrgId) ?? null;
    return NextResponse.json({
      operatingAsOrgId: operatingAsOrg?.id ?? null, operatingAsOrg, organizations,
      user: { id: user.id, name: user.name, email: user.email, profileImage: user.profileImage },
    });
  } catch (error) {
    console.error('[workspace] Could not load workspace:', error);
    return NextResponse.json({ error: 'Could not load your firms. Please try again.' }, { status: 500 });
  }
}
