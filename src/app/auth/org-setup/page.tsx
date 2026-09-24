import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { safeProfessionalCallback } from '@/lib/onboarding/professional-entry';
import { ScenarioA, type OrgIntent } from './_ScenarioA';
import '../_components/auth.css';

export const dynamic = 'force-dynamic';

export default async function OrgSetupPage({ searchParams }: {
  searchParams: { type?: string; callbackUrl?: string; add?: string };
}) {
  const callbackUrl = safeProfessionalCallback(searchParams.callbackUrl);
  const type = ['designer', 'architect', 'builder', 'vendor'].includes(searchParams.type ?? '') ? searchParams.type as OrgIntent : null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const params = new URLSearchParams({ callbackUrl });
    if (type) params.set('type', type);
    if (searchParams.add === '1') params.set('add', '1');
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent('/auth/org-setup?' + params)}`);
  }
  const memberships = await prisma.organizationUser.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { role: true, organization: { select: { id: true, name: true, type: true, location: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const firms = memberships.map(({ role, organization }) => ({ ...organization, membershipRole: role }));
  const eligible = firms.filter((org) => org.membershipRole !== 'VIEWER');
  const existingOnly = !!searchParams.callbackUrl && searchParams.add !== '1' && eligible.length > 0;
  return (
    <div className="auth-shell">
      <header className="px-6 py-6 border-b border-folio-border-subtle">
        <Link href="/" className="folio-logo-text" aria-label="Folio home">Folio</Link>
      </header>
      <main className="w-full max-w-lg mx-auto px-6 py-8 sm:py-12 space-y-6">
        <ScenarioA initialIntent={type} callbackUrl={callbackUrl} memberships={existingOnly ? eligible : firms} existingOnly={existingOnly} />
      </main>
    </div>
  );
}
