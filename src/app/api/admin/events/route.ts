import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: {
        type: 'general',
        parentFestivalId: null // Only standalone events
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        rsvps: true
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Admin events API called');
    
    // Debug: Check if we can get session info
    console.log('🔍 Request headers:', Object.fromEntries(request.headers.entries()));
    
    let title: string, description: string, location: string, startDate: string, endDate: string;
    let image: File | null = null;
    let createdById: string, parentFestivalId: string | null, eventType: string;

    // Check if the request is JSON or FormData
    const contentType = request.headers.get('content-type');
    console.log('📝 Content-Type:', contentType);
    
    if (contentType?.includes('application/json')) {
      // Handle JSON request
      const body = await request.json();
      console.log('📦 JSON body received:', body);
      title = body.title;
      description = body.description;
      location = body.location;
      startDate = body.startDate;
      endDate = body.endDate;
      createdById = body.createdById;
      parentFestivalId = body.parentFestivalId || null;
      eventType = body.type || 'general';
      console.log('🔍 Parsed values:', { title, description, location, startDate, endDate, createdById, parentFestivalId, eventType });
    } else {
      // Handle FormData request
      const formData = await request.formData();
      console.log('📦 FormData received');
      
      title = formData.get('title') as string;
      description = formData.get('description') as string;
      location = formData.get('location') as string;
      startDate = formData.get('startDate') as string;
      endDate = formData.get('endDate') as string;
      image = formData.get('image') as File | null;
      createdById = formData.get('createdById') as string;
      parentFestivalId = formData.get('parentFestivalId') as string | null;
      eventType = formData.get('eventType') as string;
      
      console.log('🔍 FormData parsed values:', { 
        title, 
        description, 
        location, 
        startDate, 
        endDate, 
        createdById, 
        parentFestivalId, 
        eventType 
      });
    }

    // Validate required fields
    console.log('✅ Validating required fields...');
    if (!title || !description || !location || !startDate || !endDate) {
      console.log('❌ Missing required fields:', { title, description, location, startDate, endDate });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    console.log('✅ All required fields present');

    // Validate that createdById exists and is a valid user
    let userId = createdById;
    console.log('👤 Validating user with createdById:', createdById);
    
    if (!createdById) {
      console.log('❌ createdById is missing');
      return NextResponse.json(
        { error: 'createdById is required' },
        { status: 400 }
      );
    }
    
    // Verify the user exists
    console.log('🔍 Looking for user with ID:', createdById);
    const user = await prisma.user.findUnique({
      where: { id: createdById }
    });
    
    if (!user) {
      console.log('❌ User not found with ID:', createdById);
      console.log('🔄 Attempting to find admin user as fallback...');
      
      // Try to find an admin user as fallback
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
      });
      
      if (adminUser) {
        console.log('✅ Using admin user as fallback:', adminUser.id);
        createdById = adminUser.id;
        userId = adminUser.id;
      } else {
        console.log('❌ No admin user found in database');
        return NextResponse.json(
          { error: 'User not found and no admin user available' },
          { status: 404 }
        );
      }
    }
    
    if (user) {
      console.log('✅ User found:', { id: user.id, name: user.name, role: user.role });
      
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Only admins can create admin events' },
          { status: 403 }
        );
      }
    }

    // Handle image upload if provided
    let imageUrl: string | undefined = undefined;
    if (image) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const fileName = `event_${Date.now()}.${image.type.split('/')[1]}`;
      const { data, error } = await supabase.storage.from('event-images').upload(fileName, image);
      if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
      }
      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    console.log('🎪 Creating event with data:', {
      title,
      description,
      location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: eventType || 'general',
      createdById: userId,
      parentFestivalId: parentFestivalId || null
    });

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type: eventType || 'general',
        isPublic: true,
        isApproved: true,
        requiresApproval: false,
        createdById: userId,
        parentFestivalId: parentFestivalId || null,
        imageUrl
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        parentFestival: parentFestivalId ? {
          select: {
            id: true,
            title: true
          }
        } : undefined
      }
    });

    console.log('✅ Event created successfully:', event.id);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
} 