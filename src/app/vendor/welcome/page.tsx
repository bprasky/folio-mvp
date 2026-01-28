import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import RepScrollPresentation from '@/components/vendor/presentation/RepScrollPresentation';

export default async function VendorWelcomePage() {
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

  // Check if user is admin — if so, redirect to pitch page
  if (['OWNER', 'ADMIN'].includes(orgUser.role)) {
    redirect('/vendor/pitch');
  }

  return (
    <RepScrollPresentation
      organizationId={orgUser.organization.id}
      organizationName={orgUser.organization.name}
    />
  );
}
