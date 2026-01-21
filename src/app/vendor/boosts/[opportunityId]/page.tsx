import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getBoostOpportunityForReview, markOpportunityViewed, canVendorBoost } from '@/lib/boost';
import { BoostReviewPanel } from '@/components/vendor/BoostReviewPanel';

interface BoostOpportunityPageProps {
  params: { opportunityId: string };
}

export default async function BoostOpportunityPage({ params }: BoostOpportunityPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const opportunity = await getBoostOpportunityForReview(params.opportunityId);

  if (!opportunity) {
    notFound();
  }

  // Verify user has access to this vendor
  const userOrg = await prisma.organizationUser.findFirst({
    where: {
      userId: session.user.id,
      organizationId: opportunity.vendorId,
      isActive: true,
    },
  });

  if (!userOrg) {
    redirect('/vendor');
  }

  // Mark as viewed if notified
  if (opportunity.status === 'NOTIFIED') {
    await markOpportunityViewed(opportunity.id);
  }

  // Get vendor's products in this project
  const vendorProductsInProject = opportunity.project.rooms.flatMap((room) =>
    room.selections
      .filter((s) => s.productTag?.product?.id)
      .map((s) => s.productTag!.product!)
  );

  // Determine status flags
  const isExpired = new Date() > opportunity.expiresAt;
  const isAlreadyBoosted = !!opportunity.boost;
  const vendorCanBoost = canVendorBoost(opportunity.vendor);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BoostReviewPanel
        opportunity={{
          id: opportunity.id,
          projectId: opportunity.projectId,
          questionId: opportunity.questionId,
          fullAnswer: opportunity.fullAnswer,
          suggestedPullQuote: opportunity.suggestedPullQuote,
          productIds: opportunity.productIds,
          sentiment: opportunity.sentiment,
          status: opportunity.status,
          expiresAt: opportunity.expiresAt,
          designer: {
            id: opportunity.designer.id,
            name: opportunity.designer.name || 'Designer',
            profileImage: opportunity.designer.profileImage,
            title: opportunity.designer.title,
            location: opportunity.designer.location,
          },
          project: {
            id: opportunity.project.id,
            title: opportunity.project.title || 'Untitled Project',
            images: opportunity.project.images.map((img) => ({ url: img.url })),
          },
          vendor: {
            id: opportunity.vendor.id,
            name: opportunity.vendor.name,
          },
          boost: opportunity.boost
            ? {
                id: opportunity.boost.id,
                pullQuote: opportunity.boost.pullQuote,
                showInArticle: opportunity.boost.showInArticle,
                showOnVendorPage: opportunity.boost.showOnVendorPage,
              }
            : null,
        }}
        vendorProducts={vendorProductsInProject}
        canBoost={vendorCanBoost}
        isExpired={isExpired}
        isAlreadyBoosted={isAlreadyBoosted}
      />
    </div>
  );
}
