// @idor-allow: public-read reason="Public event detail page viewable anonymously"
// @idor-allow: IDOR003 reason="Public lookup by event id for event modal/detail page"
// @idor-allow: IDOR004 reason="Public event read; PATCH mutation has admin auth"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { EventType } from "@/lib/eventTypes";
import { fetchEventForModal } from "@/lib/fetchEventForModal";
import { resolveFeaturedProducts } from "@/lib/events/fetchFeaturedProducts";

// Public endpoint for fetching event data for modals
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await fetchEventForModal(params.id);
    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const featuredProducts = await resolveFeaturedProducts(data.linkedProducts || []);

    return NextResponse.json({
      data,
      featuredProducts,
    });
  } catch (error: any) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH endpoint for updating events (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      startDate,
      endDate,
      location,
      imageUrl,
      eventTypes,
      isPublic,
      isApproved,
      isVirtual,
      parentFestivalId,
      linkedProducts,
    } = body;

    // Validate required fields
    if (!title || !description || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: location || null,
      imageUrl: imageUrl || null,
      isPublic: isPublic !== undefined ? isPublic : true,
      isApproved: isApproved !== undefined ? isApproved : false,
      isVirtual: isVirtual !== undefined ? isVirtual : false,
    };

    // Handle eventTypes array - convert to Prisma format
    if (eventTypes && Array.isArray(eventTypes)) {
      // Convert string array to EventType enum array
      const validEventTypes = eventTypes
        .map((et: string) => {
          // Check if it's a valid EventType enum value
          if (Object.values(EventType).includes(et as EventType)) {
            return et as EventType;
          }
          return null;
        })
        .filter((et): et is EventType => et !== null);
      
      if (validEventTypes.length > 0) {
        updateData.eventTypes = { set: validEventTypes };
      }
    }

    // Handle parentFestivalId (empty string means null)
    if (parentFestivalId !== undefined) {
      updateData.parentFestivalId = parentFestivalId === '' || parentFestivalId === null ? null : parentFestivalId;
    }

    // Handle linkedProducts array
    if (linkedProducts !== undefined && Array.isArray(linkedProducts)) {
      updateData.linkedProducts = linkedProducts;
    }

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startDate: true,
        endDate: true,
        imageUrl: true,
        eventTypes: true,
        isPublic: true,
        isApproved: true,
        isVirtual: true,
        parentFestivalId: true,
        linkedProducts: true,
      },
    });

    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
