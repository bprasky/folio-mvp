import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import OrgVendorDirectory from '@/components/org-profile/OrgVendorDirectory';

export const dynamic = 'force-dynamic';

interface Props {
  params: { orgId: string } | Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;

  const org = await prisma.organization.findUnique({
    where: { id: resolvedParams.orgId },
    select: { name: true },
  });

  if (!org) return { title: 'Not Found | Folio' };

  return {
    title: `Our Vendors — ${org.name} | Folio`,
  };
}

export default async function OrgVendorsPage({ params }: Props) {
  const resolvedParams = params instanceof Promise ? await params : params;

  // Verify org exists
  const org = await prisma.organization.findUnique({
    where: { id: resolvedParams.orgId },
    select: { id: true, name: true, type: true },
  });

  // Return 404 (not 403) to avoid confirming existence to non-members
  if (!org) notFound();

  // Require authenticated session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  // Require active org membership
  const membership = await prisma.organizationUser.findFirst({
    where: {
      organizationId: resolvedParams.orgId,
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!membership) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F7' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/org/${org.id}`}
            className="text-sm hover:underline"
            style={{ color: '#8B8178' }}
          >
            {org.name}
          </Link>
          <span style={{ color: '#C4BDB5' }}>/</span>
          <h1
            className="text-xl font-light"
            style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
          >
            Our Vendors
          </h1>
        </div>

        <Suspense
          fallback={
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-24 rounded-lg animate-pulse"
                  style={{ backgroundColor: '#E8E4DF' }}
                />
              ))}
            </div>
          }
        >
          <OrgVendorDirectory orgId={resolvedParams.orgId} />
        </Suspense>
      </div>
    </div>
  );
}
