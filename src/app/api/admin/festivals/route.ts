import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // First test the database connection
    await prisma.$connect();
    
    const festivals = await prisma.event.findMany({
      where: {
        type: 'festival',
        parentFestivalId: null // Only top-level festivals
      },
      include: {
        subevents: true,
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

    return NextResponse.json(festivals);
  } catch (error) {
    console.error('Error fetching festivals:', error);
    
    // Check if it's a table doesn't exist error
    if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database tables not created yet. Please run: npx prisma db push' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch festivals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎪 Festival creation request received');
    
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const location = formData.get('location') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const image = formData.get('image') as File | null;
    let createdById = formData.get('createdById') as string | null;

    console.log('📝 Form data received:', { title, description, location, startDate, endDate, createdById });

    // Validate required fields
    if (!title || !description || !location || !startDate || !endDate) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title, description, location, startDate, endDate' },
        { status: 400 }
      );
    }

    // Handle image upload if provided
    let imageUrl: string | undefined = undefined;
    if (image) {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const fileName = `festival_${Date.now()}.${image.type.split('/')[1]}`;
      const { data, error } = await supabase.storage.from('festival-images').upload(fileName, image);
      if (error) {
        throw new Error(`Image upload failed: ${error.message}`);
      }
      const { data: urlData } = supabase.storage.from('festival-images').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    // First check if tables exist
    try {
      console.log('🔌 Testing database connection...');
      await prisma.$connect();
      const userCount = await prisma.user.count(); // This will fail if tables don't exist
      console.log('✅ Database connected, user count:', userCount);
    } catch (tableError) {
      console.log('❌ Database connection failed:', tableError);
      return NextResponse.json(
        { 
          error: 'Database tables not created yet. Please visit: http://localhost:3001/api/init-db to initialize the database',
          details: 'Tables need to be created before creating festivals'
        },
        { status: 500 }
      );
    }

    // If no createdById provided, use an existing user
    if (!createdById) {
      console.log('👤 No createdById provided, finding existing user');
      try {
        // Try to find the admin user first
        const adminUser = await prisma.user.findFirst({
          where: { 
            OR: [
              { email: 'admin@folio.com' },
              { role: 'ADMIN' }
            ]
          }
        });
        if (adminUser) {
          createdById = adminUser.id;
          console.log('✅ Using admin user ID:', createdById);
        } else {
          // Fallback to any existing user
          const existingUser = await prisma.user.findFirst();
          if (existingUser) {
            createdById = existingUser.id;
            console.log('✅ Using existing user ID:', createdById);
          } else {
            // Create a default admin user if none exists
            console.log('👤 No users exist, creating default admin user');
            const defaultUser = await prisma.user.create({
              data: {
                email: 'admin@folio.com',
                name: 'Admin User',
                role: 'ADMIN'
              }
            });
            createdById = defaultUser.id;
            console.log('✅ Created and using default admin user ID:', createdById);
          }
        }
      } catch (userError) {
        console.log('❌ Error finding/creating user:', userError);
        throw new Error('Could not find or create a valid user for festival creation');
      }
    } else {
      // Verify the provided createdById exists
      console.log('👤 Verifying provided createdById:', createdById);
      const userExists = await prisma.user.findUnique({
        where: { id: createdById }
      });
      if (!userExists) {
        console.log('❌ Provided createdById does not exist:', createdById);
        // Use an existing user instead
        const existingUser = await prisma.user.findFirst();
        if (existingUser) {
          createdById = existingUser.id;
          console.log('✅ Using existing user ID instead:', createdById);
        } else {
          throw new Error('No valid users exist in database');
        }
      }
    }

    console.log('🎪 Creating festival in database...');
    const festival = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type: 'festival',
        isPublic: true,
        isApproved: true, // Admin-created festivals are auto-approved
        requiresApproval: false,
        createdById,
        imageUrl // Add imageUrl if uploaded
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    console.log('✅ Festival created successfully:', festival.id);
    return NextResponse.json(festival, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating festival:', error);
    
    // Check if it's a table doesn't exist error
    if (error instanceof Error && error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('❌ Database tables do not exist');
      return NextResponse.json(
        { 
          error: 'Database tables not created yet. Please visit: http://localhost:3001/api/init-db to initialize the database',
          details: 'Tables need to be created before creating festivals'
        },
        { status: 500 }
      );
    }
    
    console.log('❌ Unknown error occurred');
    return NextResponse.json(
      { error: 'Failed to create festival', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 