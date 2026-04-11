import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { InContextBoostDashboard } from '@/components/vendor/InContextBoostDashboard';

export default async function InContextBoostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const userRole = (session.user as any).role;
  const isAdmin = userRole === 'ADMIN';

  // Find vendor's organization
  let orgId: string | null = null;
  if (!isAdmin) {
    const orgMembership = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      },
      select: { organizationId: true },
    });

    if (!orgMembership) {
      redirect('/vendor');
    }
    orgId = orgMembership.organizationId;
  }

  // Fetch all In Context boost opportunities for this vendor
  const boosts = await prisma.inContextBoost.findMany({
    where: isAdmin
      ? {} // Admin sees all
      : {
          OR: [
            { vendorId: orgId },
            { vendorUserId: session.user.id },
          ],
        },
    include: {
      product: {
        select: { id: true, name: true, brand: true, imageUrl: true },
      },
      productTag: {
        select: {
          id: true,
          image: {
            select: {
              url: true,
              room: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  post: {
                    select: { slug: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
      designer: {
        select: { id: true, name: true, profileImage: true },
      },
    },
    orderBy: [
      { status: 'asc' }, // Pending first
      { createdAt: 'desc' },
    ],
  });

  // Format for client component
  const formattedBoosts = boosts.map((b) => ({
    id: b.id,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    expiresAt: b.expiresAt?.toISOString() || null,
    product: {
      id: b.product.id,
      name: b.product.name,
      brand: b.product.brand,
      imageUrl: b.product.imageUrl,
    },
    projectImage: b.productTag?.image?.url || null,
    room: b.productTag?.image?.room || null,
    projectTitle: b.productTag?.image?.project?.title || 'Untitled Project',
    articleSlug: b.productTag?.image?.project?.post?.status === 'PUBLISHED'
      ? b.productTag.image.project.post.slug
      : null,
    designer: {
      id: b.designer.id,
      name: b.designer.name,
      profileImage: b.designer.profileImage,
    },
    followUpQuestion: b.followUpQuestion,
    followUpAnswer: b.followUpAnswer,
    impressions: b.impressions,
    clicks: b.clicks,
    designerPayoutCents: b.designerPayoutCents,
    vendorSpendCents: b.vendorSpendCents,
    accuracyConfirmed: b.accuracyConfirmed,
  }));

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <InContextBoostDashboard boosts={formattedBoosts} isAdmin={isAdmin} />
    </div>
  );
}
