import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import Image from '@/components/FolioImage';
import VisitProductCard from '@/components/visits/VisitProductCard';
import VisitNotesForm from '@/components/visits/VisitNotesForm';

export const dynamic = 'force-dynamic';

type Props = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function VisitDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const resolvedParams = params instanceof Promise ? await params : params;
  const { id } = resolvedParams;

  const visit = await prisma.visitRecord.findUnique({
    where: { id },
    include: {
      initiatorUser: {
        select: {
          id: true, name: true, profileImage: true, role: true,
          title: true, phone: true, email: true, location: true,
        },
      },
      recipientUser: {
        select: {
          id: true, name: true, profileImage: true, role: true,
          title: true, phone: true, email: true, location: true,
        },
      },
      initiatorOrg: { select: { id: true, name: true, type: true, logo: true } },
      recipientOrg: { select: { id: true, name: true, type: true, logo: true } },
      event: { select: { id: true, title: true, location: true, startDate: true } },
      productShares: {
        include: {
          product: {
            select: {
              id: true, name: true, imageUrl: true, category: true,
              brand: true, price: true, url: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!visit) {
    notFound();
  }

  // Only participants can view
  if (visit.initiatorUserId !== session.user.id && visit.recipientUserId !== session.user.id) {
    notFound();
  }

  const isInitiator = visit.initiatorUserId === session.user.id;
  const otherUser = isInitiator ? visit.recipientUser : visit.initiatorUser;
  const otherOrg = isInitiator ? visit.recipientOrg : visit.initiatorOrg;
  const myNotes = isInitiator ? visit.initiatorNotes : visit.recipientNotes;

  // Get user's projects for "save to project" dropdown
  const userProjects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { designerId: session.user.id },
      ],
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  const visitTypeLabels: Record<string, string> = {
    SHOWROOM: 'Showroom Visit',
    EVENT: 'Event',
    TRADE_SHOW: 'Trade Show',
    OTHER: 'Connection',
  };

  return (
    <main className="min-h-screen bg-surface-ground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <a href="/visits" className="text-sm text-stone-500 hover:text-stone-700 mb-4 inline-block">
            &larr; All connections
          </a>
          <h1 className="text-2xl font-serif font-light text-stone-900">
            {visitTypeLabels[visit.visitType] || 'Connection'}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {new Date(visit.createdAt).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>

        {/* Both Parties */}
        <div className="bg-white rounded-lg border border-stone-200 p-6 mb-8">
          <div className="flex items-start gap-6">
            {/* Other person's card */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                {otherUser.profileImage ? (
                  <Image
                    src={otherUser.profileImage}
                    alt={otherUser.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-medium">
                    {otherUser.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-medium text-stone-900">{otherUser.name}</h2>
                  {otherUser.title && (
                    <p className="text-sm text-stone-500">{otherUser.title}</p>
                  )}
                  {otherOrg && (
                    <p className="text-sm text-stone-500">{otherOrg.name}</p>
                  )}
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1 text-sm">
                {otherUser.email && (
                  <a href={`mailto:${otherUser.email}`} className="flex items-center gap-2 text-stone-600 hover:text-stone-900">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    {otherUser.email}
                  </a>
                )}
                {otherUser.phone && (
                  <a href={`tel:${otherUser.phone}`} className="flex items-center gap-2 text-stone-600 hover:text-stone-900">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    {otherUser.phone}
                  </a>
                )}
                {otherUser.location && (
                  <p className="flex items-center gap-2 text-stone-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                    </svg>
                    {otherUser.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Event context */}
          {visit.event && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-sm text-stone-500">
                Met at <span className="font-medium text-stone-700">{visit.event.title}</span>
                {visit.event.location && ` — ${visit.event.location}`}
              </p>
            </div>
          )}

          {visit.location && !visit.event && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-sm text-stone-500">
                Location: <span className="font-medium text-stone-700">{visit.location}</span>
              </p>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="bg-white rounded-lg border border-stone-200 p-6 mb-8">
          <h3 className="text-sm font-medium text-stone-900 mb-3">Notes</h3>
          <VisitNotesForm
            visitId={visit.id}
            initialNotes={myNotes || ''}
          />
        </div>

        {/* Products Section */}
        {visit.productShares.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-stone-900 mb-4">
              Products ({visit.productShares.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {visit.productShares.map((share) => (
                <VisitProductCard
                  key={share.id}
                  visitId={visit.id}
                  productId={share.product.id}
                  name={share.product.name}
                  imageUrl={share.product.imageUrl}
                  category={share.product.category}
                  brand={share.product.brand}
                  price={share.product.price}
                  url={share.product.url}
                  autoShared={share.autoShared}
                  savedByRecipient={share.savedByRecipient}
                  savedToProjectId={share.savedToProjectId}
                  projects={userProjects}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

