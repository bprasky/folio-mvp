export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/messages/preferences
 * Get current user's messaging notification preferences.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prefs = await prisma.messagingPreferences.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      preferences: prefs || {
        emailOnNewMessage: true,
        emailOnNewInquiry: true,
        emailDigestFrequency: 'IMMEDIATE',
        pushOnNewMessage: true,
        emailOnSampleRequest: true,
        emailOnQuoteRequest: true,
        emailOnReorderRequest: true,
        emailOnCollaboration: true,
      },
    });
  } catch (error) {
    console.error('[API] preferences GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/messages/preferences
 * Update messaging notification preferences.
 * Body: partial MessagingPreferences fields
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Whitelist allowed fields
    const allowedFields = [
      'emailOnNewMessage', 'emailOnNewInquiry', 'emailDigestFrequency',
      'emailNotificationAddress', 'pushOnNewMessage',
      'emailOnSampleRequest', 'emailOnQuoteRequest',
      'emailOnReorderRequest', 'emailOnCollaboration',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const prefs = await prisma.messagingPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...updates,
      },
      update: updates,
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('[API] preferences PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
