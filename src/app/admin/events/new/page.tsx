import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';
import EventFormServer from '@/components/admin/EventFormServer';
import { headers, cookies } from 'next/headers';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { edit?: string };
}

export default async function AdminEventPage({ searchParams }: PageProps) {
  // Check if user is ADMIN
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    redirect('/auth/signin');
  }

  const editId = searchParams.edit;
  const isEditMode = !!editId;

  // Fetch festivals for the dropdown
  const festivals = await prisma.event.findMany({
    where: {
      eventTypes: {
        has: 'FESTIVAL'
      }
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      title: 'asc'
    }
  });

  if (isEditMode) {
    // Fetch existing event data
    const event = await prisma.event.findUnique({
      where: { id: editId },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        location: true,
        parentFestivalId: true,
        eventTypes: true,
        imageUrl: true,
        linkedProducts: true,
      }
    });

    if (!event) {
      redirect('/admin/events');
    }

    // Map database fields to form fields
    const defaultValues = {
      title: event.title,
      description: event.description || '',
      startsAt: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
      endsAt: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
      city: event.location || '',
      venue: event.location || '',
      festivalId: event.parentFestivalId || '',
      eventTypes: event.eventTypes,
      heroImageUrl: event.imageUrl || '',
      coverImageUrl: event.imageUrl || '',
      linkedProducts: event.linkedProducts || [],
    };

    const handleUpdate = async (values: any) => {
      'use server';
      
      console.log('🚀 SERVER ACTION CALLED - handleUpdate started');
      
      try {
        console.log('🔄 Server action: Starting update for event', editId);
        console.log('📤 Server action: Values received:', JSON.stringify(values, null, 2));
        console.log('🖼️ Server action: Image fields:', {
          heroImageUrl: values.heroImageUrl,
          coverImageUrl: values.coverImageUrl,
          imageUrl: values.imageUrl,
        });
        console.log('🔍 Server action: Event data:', {
          id: event.id,
          title: event.title,
          parentFestivalId: event.parentFestivalId,
          currentImageUrl: event.imageUrl
        });
        
        // Get current event data to ensure we have fallback dates
        const currentStartsAt = event.startDate ? new Date(event.startDate).toISOString() : null;
        const currentEndsAt = event.endDate ? new Date(event.endDate).toISOString() : null;
        
        // Transform payload: format dates as ISO strings and handle image URLs
        const payload = {
          ...values,
          startsAt: values.startsAt
            ? new Date(values.startsAt).toISOString()
            : currentStartsAt,            // ensure non-empty
          endsAt: values.endsAt
            ? new Date(values.endsAt).toISOString()
            : currentEndsAt,              // ensure non-empty
          heroImageUrl: values.heroImageUrl !== undefined ? values.heroImageUrl : (event.imageUrl || null),
          coverImageUrl: values.coverImageUrl !== undefined ? values.coverImageUrl : (event.imageUrl || null),
        };
        
        console.log('📤 Server action: Transformed payload:', payload);
        
        // Build SAME-ORIGIN base from the incoming request
        const h = headers();
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? 'localhost:3000';
        const base  = `${proto}://${host}`; // works on 3000 or 3001

        const endpoint = `${base}/api/events/${editId}`;
        
        console.log('🌐 Server action: Making request to:', endpoint);
        console.log('🍪 Server action: Cookie header length:', cookies().toString().length);
        
        // Forward auth cookies so NextAuth sees your ADMIN session
        const cookieHeader = cookies().toString();
        
        const response = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            // critical: forward cookies from the action to the API route
            cookie: cookieHeader,
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
          redirect: 'manual', // fail fast if API tries to redirect to signin
        });

        console.log('📥 Server action: Response status:', response.status);
        console.log('📥 Server action: Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const txt = await response.text();
          console.error('❌ Server action: Update failed:', response.status, txt);
          console.error('❌ Server action: Response body:', txt);
          throw new Error(`Update failed (${response.status}): ${txt}`);
        }

        const result = await response.json();
        console.log('✅ Server action: Update successful:', result);
        console.log('🔄 Server action: Update data saved to database');

        // Add a small delay to allow UI to update before redirect
        console.log('⏳ Server action: Waiting 1 second before redirect...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Smart redirect based on event type with cache busting
        if (event.parentFestivalId) {
          console.log('🔄 Server action: Redirecting to festival:', event.parentFestivalId);
          redirect(`/events/${event.parentFestivalId}?t=${Date.now()}`);
        } else {
          console.log('🔄 Server action: Redirecting to events list');
          redirect(`/events?t=${Date.now()}`);
        }
      } catch (error) {
        console.error('❌ Server action error:', error);
        throw error;
      }
    };

    const handleDelete = async () => {
      'use server';
      
      // Build SAME-ORIGIN base from the incoming request
      const h = headers();
      const proto = h.get('x-forwarded-proto') ?? 'http';
      const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? 'localhost:3000';
      const base  = `${proto}://${host}`; // works on 3000 or 3001

      const endpoint = `${base}/api/events/${editId}`;
      
      // Forward auth cookies so NextAuth sees your ADMIN session
      const cookieHeader = cookies().toString();
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          // critical: forward cookies from the action to the API route
          cookie: cookieHeader,
        },
        cache: 'no-store',
        redirect: 'manual', // fail fast if API tries to redirect to signin
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      // Redirect based on whether the event had a parent festival
      if (event.parentFestivalId) {
        redirect(`/events/${event.parentFestivalId}`);
      } else {
        redirect('/events');
      }
    };

    return (
      <EventFormServer
        mode="edit"
        defaultValues={defaultValues}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        festivals={festivals}
      />
    );
  } else {
    // Create mode
    const handleCreate = async (values: any) => {
      'use server';
      
      try {
        console.log('🔄 Server action: Starting create for event');
        console.log('📤 Server action: Values received:', values);
        
        // Transform payload: format dates as ISO strings and handle image URLs
        const payload = {
          ...values,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
          heroImageUrl: values.heroImageUrl || null,
          coverImageUrl: values.coverImageUrl || null,
        };
        
        console.log('📤 Server action: Transformed payload:', payload);
        
        // Build SAME-ORIGIN base from the incoming request
        const h = headers();
        const proto = h.get('x-forwarded-proto') ?? 'http';
        const host  = h.get('x-forwarded-host')  ?? h.get('host') ?? 'localhost:3000';
        const base  = `${proto}://${host}`; // works on 3000 or 3001

        const endpoint = `${base}/api/events`;
        
        // Forward auth cookies so NextAuth sees your ADMIN session
        const cookieHeader = cookies().toString();
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // critical: forward cookies from the action to the API route
            cookie: cookieHeader,
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
          redirect: 'manual', // fail fast if API tries to redirect to signin
        });

        if (!response.ok) {
          const txt = await response.text();
          console.error('Create failed:', response.status, txt);
          throw new Error(`Create failed (${response.status}): ${txt}`);
        }

        const newEvent = await response.json();
        redirect(`/events/${newEvent.id}`);
      } catch (error) {
        console.error('Server action error:', error);
        throw error;
      }
    };

    return (
      <EventFormServer
        mode="create"
        onSubmit={handleCreate}
        festivals={festivals}
      />
    );
  }
} 