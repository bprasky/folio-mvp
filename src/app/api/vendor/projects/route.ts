import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canAccessVendor } from '@/lib/permissions';
import { z } from 'zod';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = normalizeRole(session?.user?.role);
  const userId = (session?.user as any)?.id as string | undefined;

  if (process.env.NODE_ENV === 'development') {
    console.log('[create-vendor-project]', { 
      hasCookie: !!request.headers.get('cookie'), 
      email: session?.user?.email, 
      role, 
      userId 
    });
  }

  if (!userId) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 });
  }

  if (!canAccessVendor(role)) {
    return NextResponse.json({ error: 'Your role is not permitted to create vendor projects' }, { status: 403 });
  }

  try {
    // Validate payload with zod
    const vendorProjectSchema = z.object({
      title: z.string().min(1, 'Title is required'),
      type: z.string().min(1, 'Type is required'),
      location: z.string().min(1, 'Location is required'),
      description: z.string().min(1, 'Description is required'),
      styleTags: z.array(z.string()).min(1, 'At least one style tag is required'),
      vendorId: z.string().optional(), // Will use session user ID instead
    });

    const validatedPayload = vendorProjectSchema.parse(await request.json());
    const { title, type, location, description, styleTags } = validatedPayload;

    console.log('DEBUG: Received vendor project creation request:', {
      title,
      type,
      location,
      description,
      styleTags,
      userId
    });

    // Create the project using session user ID
    const project = await prisma.project.create({
      data: {
        name: title,
        category: type,
        description,
        ownerId: userId,
        status: 'draft'
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log('Vendor project created successfully:', project);
    return NextResponse.json(project, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: e.issues.map((err: any) => ({ field: err.path.join('.'), message: err.message }))
      }, { status: 400 });
    }
    console.error('Error creating vendor project:', e);
    return NextResponse.json(
      { error: 'Failed to create project', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Fetch projects owned by the vendor user
    const projects = await prisma.project.findMany({
      where: {
        ownerId: userId
      },
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        _count: {
          select: {
            rooms: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching vendor projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 