import { Suspense } from "react";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import Link from 'next/link';
import FestivalsCarousel from "@/components/events/FestivalsCarousel";
import LocalContextHeader from "@/components/events/LocalContextHeader";
import FlowMosaic from "@/components/feed/FlowMosaic";
import { getLocalEvents, getUserCity, getFestivalEvents } from "@/lib/events/queries";

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: { city?: string; radius?: string };
}) {
  // session / role handling for canEdit prop
  let session = null as any;
  let userRole = 'guest';
  try {
    session = await getServerSession(authOptions);
    userRole = session?.user?.role || 'guest';
  } catch {}
  
  const isAdmin = userRole === 'ADMIN';

  const userCity = await getUserCity(); // e.g., via IP or profile (string like "Miami")
  const city = searchParams?.city ?? userCity ?? "Miami";
  const radius = Number(searchParams?.radius ?? 25);

  const localEvents = await getLocalEvents({ city, radius }); // returns local events (array)
  const festivals = await getFestivalEvents(); // returns festivals for carousel

  return (
    <main className="pt-6 md:pt-8 pb-12">
      {/* Admin Controls */}
      {isAdmin && (
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 mb-4 md:mb-6">
          <div className="flex flex-wrap gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Link 
              href="/admin/festivals/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Festival
            </Link>
            <Link 
              href="/events/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Event
            </Link>
          </div>
        </div>
      )}

      {/* Edge-to-edge Festival Carousel */}
      <section aria-label="Festival timeline" className="mb-10">
        <Suspense fallback={<div className="h-[400px] bg-neutral-100" />}>
          <FestivalsCarousel festivals={festivals} />
        </Suspense>
      </section>

      {/* Edge-to-edge Local Events Feed */}
      <section aria-label="Nearby events">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 mb-6">
          <LocalContextHeader city={city} radius={radius} />
        </div>
        <div className="mx-[calc(50%-50vw)] px-4 md:px-6 lg:px-8">
          <FlowMosaic events={localEvents} canEdit={isAdmin} />
        </div>
      </section>
    </main>
  );
} 