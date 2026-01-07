import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canAccessAdmin } from '@/lib/permissions';
import { z } from 'zod';

interface ProjectImage {
  id: string;
  url: string;
  name: string;
  tags: ProductTag[];
}

interface ProductTag {
  id: string;
  x: number;
  y: number;
  product: {
    id: string;
    name: string;
    brand: string;
    price: string;
    image: string;
    vendorId: string;
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const role = normalizeRole(session?.user?.role);
  const userId = (session?.user as any)?.id as string | undefined;

  if (process.env.NODE_ENV === 'development') {
    console.log('[create-admin-project]', { 
      hasCookie: !!request.headers.get('cookie'), 
      email: session?.user?.email, 
      role, 
      userId 
    });
  }

  if (!userId) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 });
  }

  if (!canAccessAdmin(role)) {
    return NextResponse.json({ error: 'Your role is not permitted to create admin projects' }, { status: 403 });
  }

  try {
    // Validate payload with zod
    const adminProjectSchema = z.object({
      name: z.string().min(1, 'Project name is required'),
      description: z.string().optional(),
      category: z.string().min(1, 'Category is required'),
      client: z.string().optional(),
      designerId: z.string().min(1, 'Designer ID is required'),
      images: z.array(z.any()).optional(),
    });

    const validatedPayload = adminProjectSchema.parse(await request.json());
    const { name, description, category, client, designerId, images } = validatedPayload;

    // Verify the designer user exists
    const designer = await prisma.user.findUnique({
      where: { id: designerId },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!designer) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    if (designer.role !== 'DESIGNER') {
      return NextResponse.json({ error: 'Specified user is not a designer' }, { status: 400 });
    }

    // Create the project in the database
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        category: category.trim(),
        designerId: designerId.trim(),
        ownerId: designerId.trim(), // Designer owns the project
        status: 'draft',
        isPublic: false,
        isAIEnabled: false,
        views: 0,
        saves: 0,
        shares: 0,
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log('Admin project created successfully:', project);
    
    return NextResponse.json(project, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: e.issues.map((err: any) => ({ field: err.path.join('.'), message: err.message }))
      }, { status: 400 });
    }
    console.error('Error creating admin project:', e);
    return NextResponse.json(
      { error: 'Failed to create project', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 