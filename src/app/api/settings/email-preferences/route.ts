export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getOrCreateProxyAddress } from '@/lib/email/proxy-address';

/**
 * GET /api/settings/email-preferences
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: {
        emailSendPreference: true,
        signatureIncludeFirm: true,
        signatureIncludePhone: true,
        signatureIncludeProfile: true,
        signatureIncludeEmail: true,
      },
    });

    const proxyAddress = await getOrCreateProxyAddress(session.user.id);

    return NextResponse.json({
      ...user,
      proxyAddress,
    });
  } catch (error) {
    console.error('[API] GET /api/settings/email-preferences error:', error);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/email-preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.emailSendPreference === 'string' && ['folio', 'mailto', 'ask'].includes(body.emailSendPreference)) {
      updateData.emailSendPreference = body.emailSendPreference;
    }
    if (typeof body.signatureIncludeFirm === 'boolean') updateData.signatureIncludeFirm = body.signatureIncludeFirm;
    if (typeof body.signatureIncludePhone === 'boolean') updateData.signatureIncludePhone = body.signatureIncludePhone;
    if (typeof body.signatureIncludeProfile === 'boolean') updateData.signatureIncludeProfile = body.signatureIncludeProfile;
    if (typeof body.signatureIncludeEmail === 'boolean') updateData.signatureIncludeEmail = body.signatureIncludeEmail;

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] PATCH /api/settings/email-preferences error:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
