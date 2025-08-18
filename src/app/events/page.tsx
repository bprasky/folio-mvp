import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/options';
import FestivalCarousel from '../../components/FestivalCarousel';
import EditorialFeed from '../../components/feed/EditorialFeed';
import RoleBasedActions from '../../components/RoleBasedActions';
import { fetchEvents, fetchUserRSVPs } from '../../lib/fetchEvents';
import { fetchFestivals } from '../../lib/fetchFestivals';
import { mapEventsToFeedItems } from '../../lib/feedUtils';
import { getRole } from '../../lib/getRole';
import prisma from '@/lib/prisma';

export default async function EventsPage() {
  let session = null;
  let userRole = 'guest';

  try {
    session = await getServerSession(authOptions);
    userRole = session?.user?.role || 'guest';
    // DEBUG: Log session and userRole
    console.log('SESSION:', JSON.stringify(session));
    console.log('userRole:', userRole);
  } catch (error) {
    console.log('Session error:', error);
    console.log('No session found, proceeding as guest');
  }

  // Get role for admin checks
  const role = await getRole();
  const canEdit = role === 'ADMIN';

  try {
    console.log('Fetching events data...');
    // Fetch data using the new API functions
    const [events, festivals, userRSVPs] = await Promise.all([
      fetchEvents(userRole, session?.user?.id),
      fetchFestivals(),
      session?.user?.id ? fetchUserRSVPs(session.user.id) : Promise.resolve([])
    ]);

    console.log(`Fetched ${events.length} events, ${festivals.length} festivals`);
    // Map events to feed format
    const feedItems = mapEventsToFeedItems(events);
    console.log(`Mapped ${feedItems.length} feed items`);

    return (
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="p-6">
          {/* Header with Role-Based Actions */}
          <div className="bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="mb-4 lg:mb-0">
                  <h1 className="text-3xl font-bold text-gray-900">Events</h1>
                  <p className="mt-2 text-gray-600">
                    Discover and participate in the latest design events and festivals
                  </p>
                </div>
                <RoleBasedActions userRole={userRole} />
              </div>
            </div>
          </div>

          {/* Festival Carousel */}
          <div className="bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <FestivalCarousel festivals={festivals} canEdit={canEdit} />
            </div>
          </div>

          {/* Editorial Event Feed */}
          <div className="bg-white">
            <div className="py-8">
              <EditorialFeed items={feedItems} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading events page:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return (
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">We're having trouble loading the events right now.</p>
            <a 
              href="/events"
              className="inline-block bg-folio-accent text-white px-6 py-3 rounded-lg hover:bg-folio-accent-dark transition-colors"
            >
              Try Again
            </a>
          </div>
        </div>
      </div>
    );
  }
} 