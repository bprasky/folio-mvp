import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import AdminScrollPresentation from '@/components/vendor/presentation/AdminScrollPresentation';

export default async function VendorPitchPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Get user's vendor organization
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      organization: {
        type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!orgUser) {
    redirect('/vendor/dashboard');
  }

  // Admins/owners see the admin pitch; others are redirected to welcome
  if (!['OWNER', 'ADMIN'].includes(orgUser.role)) {
    redirect('/vendor/welcome');
  }

  return (
    <AdminScrollPresentation
      organizationId={orgUser.organization.id}
      organizationName={orgUser.organization.name}
    />
  );
}
