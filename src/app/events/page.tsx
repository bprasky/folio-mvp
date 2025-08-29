import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// keep your existing imports:
import FestivalCarousel from '@/components/FestivalCarousel';
import EventMosaic from '@/components/events/EventMosaic';

// add (or keep) your data helpers:
import { fetchEvents, fetchUserRSVPs } from '@/lib/fetchEvents';
import { fetchFestivals } from '@/lib/fetchFestivals';

export default async function EventsPage() {
  // session / role
  let session = null as any;
  let userRole = 'guest';
  try {
    session = await getServerSession(authOptions);
    userRole = session?.user?.role || 'guest';
  } catch {}

  const userId = session?.user?.id;
  const isAdmin = userRole === 'ADMIN';

  // fetch in parallel
  const [eventsRaw, festivalsRaw] = await Promise.all([
    fetchEvents(userRole, userId),
    fetchFestivals(),
  ]);

  // PUBLIC GATING for non-admins:
  // fetchEvents already includes isPublic OR createdById,
  // but it doesn't gate by isApproved. Enforce here for guests.
  const events = isAdmin
    ? eventsRaw
    : eventsRaw.filter((e: any) => e?.isPublic === true && e?.isApproved === true);

  // festivals already come approved+future/ongoing from fetchFestivals.
  // If you ever need top-level only, keep this filter (safe either way):
  const festivals = (festivalsRaw ?? []).filter((f: any) => (f?.parentFestivalId ?? null) === null || true);

  // events from fetchEvents are already NON-FESTIVAL; feed straight to mosaic
  const mosaicEvents = events;

  return (
    <main className="bg-gray-50">
      <div className="select-text mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* header (keep whatever you already render here) */}
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Events</h1>
            <p className="mt-1 text-gray-600">Discover festivals and events across the design community.</p>
          </div>
          {/* keep your role-based actions if present */}
        </header>

        {/* FESTIVALS — carousel near the top */}
        {festivals.length > 0 && (
          <section aria-label="Featured festivals" className="mb-8">
            <FestivalCarousel festivals={festivals} canEdit={isAdmin} />
          </section>
        )}

        {/* EVENTS — dense mosaic below */}
        <section aria-label="Explore events">
          <EventMosaic events={mosaicEvents} />
        </section>
      </div>
    </main>
  );
} 