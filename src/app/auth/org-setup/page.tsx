import { ProfessionalSetupFrame } from '@/components/onboarding/ProfessionalSetupFrame';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { safeProfessionalCallback } from '@/lib/onboarding/professional-entry';
import { ScenarioA, type OrgIntent } from './_ScenarioA';
import '../_components/auth.css';

export const dynamic = 'force-dynamic';

export default async function OrgSetupPage({ searchParams }: {
  searchParams: { type?: string; callbackUrl?: string; add?: string; orgId?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ? safeProfessionalCallback(searchParams.callbackUrl) : '/settings';
  const type = ['designer', 'architect', 'builder', 'vendor'].includes(searchParams.type ?? '') ? searchParams.type as OrgIntent : null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const params = new URLSearchParams();
    if (searchParams.callbackUrl) params.set('callbackUrl', callbackUrl);
    if (type) params.set('type', type);
    if (searchParams.add === '1') params.set('add', '1');
    if (searchParams.orgId) params.set('orgId', searchParams.orgId);
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent('/auth/org-setup' + (params.size ? '?' + params : ''))}`);
  }
  const memberships = await prisma.organizationUser.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { role: true, organization: { select: { id: true, name: true, type: true, location: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const firms = memberships.map(({ role, organization }) => ({ ...organization, membershipRole: role }));
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id }, select: { name: true, email: true, operatingAsOrgId: true },
  });
  const initialFirm = searchParams.orgId ? await prisma.organization.findUnique({
    where: { id: searchParams.orgId }, select: { id: true, name: true, type: true, location: true },
  }) : null;
  const eligible = firms.filter((org) => org.membershipRole !== 'VIEWER');
  const existingOnly = !!searchParams.callbackUrl && searchParams.add !== '1' && !searchParams.orgId && eligible.length > 0;
  return (
    <ProfessionalSetupFrame stage="business">
      <ScenarioA initialIntent={type} callbackUrl={callbackUrl} memberships={firms} account={account} initialFirm={initialFirm}
        existingOnly={existingOnly} accountOverview={!searchParams.callbackUrl && !searchParams.orgId && searchParams.add !== '1' && firms.length > 0} />
    </ProfessionalSetupFrame>
  );
}
