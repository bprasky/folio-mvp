import { NextRequest, NextResponse } from 'next/server';
import { getMyProjects } from '@/server/queries/getMyProjects';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * Debug route to verify project ownership queries
 * Remove after QA complete
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get filter from query param
    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get('filter') || 'all') as 'all' | 'published' | 'draft';

    const projects = await getMyProjects(filter);
    
    return NextResponse.json({ 
      userId: session.user.id,
      email: session.user.email,
      filter,
      count: projects.length,
      breakdown: {
        published: projects.filter(p => p.isPublic || p.publishedAt).length,
        draft: projects.filter(p => !p.isPublic && !p.publishedAt).length,
      },
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        isPublic: p.isPublic,
        publishedAt: p.publishedAt,
        designerId: p.designerId,
        ownerId: p.ownerId,
      }))
    });
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}

