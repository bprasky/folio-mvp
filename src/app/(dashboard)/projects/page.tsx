import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { normalizeRole } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { normalizeSort, sortToOrderBy } from './_lib/sort';
import ProjectsKanbanBoard from './ProjectsKanbanBoard';
import ProjectsGridView from './ProjectsGridView';
import SortFilterBar from './_components/SortFilterBar';
import ProjectStatsStrip from '@/components/projects/ProjectStatsStrip';

export const dynamic = 'force-dynamic';

interface ProjectsPageProps {
  searchParams: { sort?: string };
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const role = normalizeRole(session.user.role);
  if (role !== 'DESIGNER' && role !== 'ADMIN') {
    redirect('/');
  }

  // Normalize sort parameter
  const sortKey = normalizeSort(searchParams.sort);
  const isPhaseView = sortKey === 'phase';

  // Fetch projects with appropriate sorting
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { designerId: session.user.id }
      ]
    },
    include: {
      images: {
        take: 1,
        orderBy: { createdAt: 'asc' }
      },
      owner: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: isPhaseView ? [{ stage: 'asc' }, { updatedAt: 'desc' }] : sortToOrderBy(sortKey)
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
          <p className="mt-2 text-gray-600">Manage and track your design projects through each stage</p>
        </div>
        
        {/* Project Statistics Overview */}
        <ProjectStatsStrip />
        
        <SortFilterBar />
        
        {isPhaseView ? (
          <ProjectsKanbanBoard projects={projects} />
        ) : (
          <ProjectsGridView projects={projects} sortKey={sortKey} />
        )}
      </div>
    </div>
  );
}
