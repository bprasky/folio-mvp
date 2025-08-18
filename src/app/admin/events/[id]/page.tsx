import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import EventAdminForm from '@/components/admin/EventAdminForm';
import prisma from '@/lib/prisma';

interface EventAdminPageProps {
  params: {
    id: string;
  };
}

export default async function EventAdminPage({ params }: EventAdminPageProps) {
  const session = await getServerSession(authOptions);
  
  // Check if user is admin
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/auth');
  }

  try {
    // Fetch event data
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        isVirtual: true,
        eventTypes: true,
        imageUrl: true,
        isPublic: true,
        isApproved: true,
        parentFestivalId: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parentFestival: {
          select: {
            id: true,
            title: true,
          },
        },
        subevents: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!event) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
            <p className="text-gray-600">The event you're looking for doesn't exist.</p>
          </div>
        </div>
      );
    }

    // Fetch available festivals for the dropdown
    const festivals = await prisma.event.findMany({
      where: {
        eventTypes: {
          has: 'FESTIVAL',
        },
        isApproved: true,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        title: 'asc',
      },
    });

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                Edit Event: {event.title}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Created by {event.createdBy.name} ({event.createdBy.email})
              </p>
            </div>
            
            <div className="p-6">
              <EventAdminForm 
                initialEvent={event} 
                availableFestivals={festivals}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading event:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Event</h1>
          <p className="text-gray-600">Something went wrong while loading the event.</p>
        </div>
      </div>
    );
  }
} 