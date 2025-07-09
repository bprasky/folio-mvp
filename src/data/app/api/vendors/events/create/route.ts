import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // Temporarily comment out authentication for testing
    // const session = await getServerSession(authOptions);
    // if (!session || session.user.role !== 'vendor') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    // const userId = session.user.id;
    
    // For testing, use a default user ID
    const userId = 'test-vendor-id';
    
    const body = await req.json();
    const { title, description, location, startDate, endDate, parentFestivalId } = body;
    if (!title || !description || !location || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    let requiresApproval = false;
    let isApproved = true;
    let festival: any = null;
    if (parentFestivalId) {
      festival = await prisma.event.findUnique({ 
        where: { 
          id: parentFestivalId,
          type: 'festival' // Ensure it's actually a festival
        } 
      });
      if (!festival) {
        return NextResponse.json({ error: 'Festival not found' }, { status: 400 });
      }
      if (startDate < festival.startDate || endDate > festival.endDate) {
        return NextResponse.json({ error: `Event dates must be within the festival's range (${festival.startDate} to ${festival.endDate})` }, { status: 400 });
      }
      requiresApproval = true;
      isApproved = false;
    }
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate,
        endDate,
        parentFestivalId: parentFestivalId || null,
        requiresApproval,
        isApproved,
        createdById: userId, // Use the user ID directly
      },
    });
    const toastMsg = parentFestivalId && festival
      ? `Your event has been submitted for approval to ${festival.title}.`
      : 'Event created!';
    return NextResponse.json({ event, toastMessage: toastMsg }, { status: 200 });
  } catch (error) {
    console.error('Error creating vendor event:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 