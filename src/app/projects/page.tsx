import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { getMyProjectsWithStats } from '@/server/queries/getMyProjectsWithStats';
import { getPendingDeletionRequests } from '@/server/queries/getPendingDeletionRequests';
import ProjectsPageClient from './ProjectsPageClient';

export const dynamic = 'force-dynamic';

interface ProjectsPageProps {
  searchParams: { sort?: string };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  try {
    const session = await getServerSession(authOptions);

    // DEBUG: Log session info to diagnose redirect issues
    console.log('[ProjectsPage] DEBUG Session:', {
      hasSession: !!session,
      userId: session?.user?.id,
      role: session?.user?.role,
      normalizedRole: session?.user?.role ? normalizeRole(session.user.role) : 'NO_ROLE',
      email: session?.user?.email,
      operatingAsOrgId: (session?.user as any)?.operatingAsOrgId,
    });

    if (!session?.user?.id) {
      console.log('[ProjectsPage] No session, redirecting to signin');
      redirect('/auth/signin');
    }

    // All authenticated users can access projects
    // (permissions/capabilities within projects are handled separately)

    // Get the operating context from session
    const operatingAsOrgId = (session.user as any)?.operatingAsOrgId as string | null | undefined;

    // Fetch projects with computed stats, filtered by operating context
    const projects = await getMyProjectsWithStats(operatingAsOrgId);

    // Pending deletion requests this user can approve (org Owner/Admin).
    const pendingDeletionRequests = await getPendingDeletionRequests(
      session.user.id,
      session.user.role as string | null | undefined,
    );

    return (
      <ProjectsPageClient
        projectsRaw={projects}
        operatingAsOrgId={operatingAsOrgId}
        pendingDeletionRequests={pendingDeletionRequests}
      />
    );
  } catch (error) {
    console.error('[ProjectsPage] Error:', error);
    // Re-throw to show error page instead of 404
    throw error;
  }
}
