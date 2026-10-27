import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import Image from '@/components/FolioImage';
import Link from 'next/link';
import AddConnectionButton from '@/components/visits/AddConnectionButton';

export const dynamic = 'force-dynamic';

const visitTypeLabels: Record<string, string> = {
  SHOWROOM: 'Showroom',
  EVENT: 'Event',
  TRADE_SHOW: 'Trade Show',
  OTHER: 'Connection',
};

export default async function VisitsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const userId = session.user.id;

  const visits = await prisma.visitRecord.findMany({
    where: {
      OR: [
        { initiatorUserId: userId },
        { recipientUserId: userId },
      ],
    },
    include: {
      initiatorUser: {
        select: { id: true, name: true, profileImage: true, role: true, title: true },
      },
      recipientUser: {
        select: { id: true, name: true, profileImage: true, role: true, title: true },
      },
      initiatorOrg: { select: { id: true, name: true, type: true } },
      recipientOrg: { select: { id: true, name: true, type: true } },
      event: { select: { id: true, title: true } },
      _count: { select: { productShares: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <main className="min-h-screen bg-surface-ground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-serif font-light text-stone-900">
            Connections
          </h1>
          <AddConnectionButton />
        </div>

        {visits.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-stone-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-stone-500">No connections yet.</p>
            <p className="text-sm text-stone-400 mt-1">
              Scan someone&apos;s Folio Badge to create your first connection.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => {
              const isInitiator = visit.initiatorUserId === userId;
              const otherUser = isInitiator ? visit.recipientUser : visit.initiatorUser;
              const otherOrg = isInitiator ? visit.recipientOrg : visit.initiatorOrg;

              return (
                <Link
                  key={visit.id}
                  href={`/visits/${visit.id}`}
                  className="block bg-white rounded-lg border border-stone-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {otherUser.profileImage ? (
                      <Image
                        src={otherUser.profileImage}
                        alt={otherUser.name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-sm font-medium shrink-0">
                        {otherUser.name.charAt(0)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-stone-900 truncate">
                          {otherUser.name}
                        </h2>
                        {otherOrg && (
                          <span className="text-xs text-stone-400 truncate">
                            {otherOrg.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-stone-500">
                          {visitTypeLabels[visit.visitType] || 'Connection'}
                        </span>
                        {visit.event && (
                          <>
                            <span className="text-xs text-stone-300">&middot;</span>
                            <span className="text-xs text-stone-500">{visit.event.title}</span>
                          </>
                        )}
                        {visit._count.productShares > 0 && (
                          <>
                            <span className="text-xs text-stone-300">&middot;</span>
                            <span className="text-xs text-stone-500">
                              {visit._count.productShares} product{visit._count.productShares !== 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <span className="text-xs text-stone-400 shrink-0">
                      {new Date(visit.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
