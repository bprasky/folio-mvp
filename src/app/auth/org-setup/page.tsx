import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { Topbar } from '../_components/Topbar';
import { PhotoPanel } from '../_components/PhotoPanel';
import { PageFooter } from '../_components/PageFooter';
import { ScenarioA, type OrgIntent } from './_ScenarioA';
import { ScenarioB, type UserOrg } from './_ScenarioB';
import '../_components/auth.css';

export const dynamic = 'force-dynamic';

function isOrgIntent(v: string | string[] | undefined): v is OrgIntent {
  return v === 'designer' || v === 'architect' || v === 'builder' || v === 'vendor';
}

export default async function OrgSetupPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    // Missing NEXTAUTH_SECRET in non-prod envs would throw here; degrade to
    // anonymous rather than erroring the whole page.
    console.error('[/auth/org-setup] getServerSession failed:', err);
  }

  // Logged-in users: fetch their existing org memberships. Anonymous users
  // get an empty list and land in scenario A (the page still lets the org
  // create/join endpoints reject them with 401 if they try to submit).
  let userOrgs: UserOrg[] = [];
  if (session?.user?.id) {
    try {
      const memberships = await prisma.organizationUser.findMany({
        where: { userId: session.user.id, isActive: true },
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, type: true, capabilities: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });
      userOrgs = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        type: m.organization.type,
        capabilities: m.organization.capabilities,
        membershipRole: m.role,
      }));
    } catch (err) {
      // DB hiccup: degrade gracefully to scenario A rather than crashing the
      // page. The "no orgs" branch still works for everyone.
      console.error('[/auth/org-setup] Failed to load memberships:', err);
    }
  }

  const initialIntent = isOrgIntent(searchParams.type) ? searchParams.type : null;
  const isScenarioB = userOrgs.length > 0;

  const photoDescription = isScenarioB
    ? 'Stack another capability on the page you already run, or stand up a new one alongside it. Either way, the credit line stays with the people who did the work.'
    : 'Where the work gets named. Your organization becomes the credit line on every project you bring to Folio — pieces tagged, rooms attributed, story intact.';

  return (
    <div className="auth-shell">
      <Topbar />
      <main className="auth-stage">
        <PhotoPanel
          imageSrc="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80"
          imageAlt="Sitting room in cream linen and oak, soft afternoon light"
          eyebrow="From Issue 09 · Cape Town"
          description={photoDescription}
          counter="04 / 04"
        />
        <section className="auth-form-panel" aria-label="Organization setup">
          {isScenarioB ? (
            <ScenarioB initialIntent={initialIntent} userOrgs={userOrgs} />
          ) : (
            <ScenarioA initialIntent={initialIntent} />
          )}
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
