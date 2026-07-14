import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { maybeUnlockEditorialQueue } from '@/lib/editorial-queue/unlock';

// POST /api/editorial-queue/generate
//
// Manual/self trigger for the Editorial Queue three-story gate. The publish
// paths fire the same unlock automatically on the third publish; this route
// exists for designers who were already eligible before the feature shipped
// (the gate never ran for them at publish time). Idempotent: once unlocked, it
// returns already_unlocked and does not regenerate.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await maybeUnlockEditorialQueue(session.user.id, null);
  return NextResponse.json(result, { status: 200 });
}
