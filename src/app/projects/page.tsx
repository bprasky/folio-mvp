import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { getMyProjectsWithStats } from '@/server/queries/getMyProjectsWithStats';
import ProjectsPageClient from './ProjectsPageClient';

export const dynamic = 'force-dynamic';

interface ProjectsPageProps {
  searchParams: { sort?: string };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      redirect('/auth/signin');
    }

    const role = normalizeRole(session.user.role);
    if (role !== 'DESIGNER' && role !== 'ADMIN') {
      redirect('/');
    }

    // Fetch projects with computed stats (read-only, no writes)
    const projects = await getMyProjectsWithStats();

    return <ProjectsPageClient projectsRaw={projects} />;
  } catch (error) {
    console.error('[ProjectsPage] Error:', error);
    // Re-throw to show error page instead of 404
    throw error;
  }
}
