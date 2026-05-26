import { redirect } from 'next/navigation';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export const dynamic = 'force-dynamic';

// /professionals is now an alias for the unified enrollment flow. Anyone
// who arrives here — old marketing links, inbound CTAs, search hits — gets
// pushed to the same starting point as a freshly-signed-up individual:
//
//   - Not signed in → /auth/signup. The chip picker on that page is the
//     entry to picking a pro intent and creating the account.
//   - Signed in    → /auth/org-setup. The same enrollment page that pops
//     up after individual signup (scenario A or B depending on existing
//     org memberships).
//
// See docs/AUTH_ORG_ENROLLMENT_FLOW.md for the journey.
export default async function ProfessionalsPage() {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error('[/professionals] getServerSession failed:', err);
  }

  if (session?.user?.id) {
    redirect('/auth/org-setup');
  }
  redirect('/auth/signup');
}
