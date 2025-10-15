import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import ProjectTabs from './ProjectTabs';
import MediaSection from './MediaSection';
import DesignerBoard from './DesignerBoard';
import ProjectHero from './ProjectHero';
import ProjectMediaManager from './ProjectMediaManager';

type TabView = 'overview' | 'media' | 'boards';

export default async function ProjectPage({ 
  params, 
  searchParams 
}: { 
  params: { id: string };
  searchParams: { view?: string };
}) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const viewerRole = (session as any)?.user?.role ?? 'GUEST';

  // Fetch by ID only — never add owner constraints here
  const base = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      projectType: true,
      clientType: true,
      budgetBand: true,
      city: true,
      regionState: true,
      updatedAt: true,
      ownerId: true,
      createdAt: true,
      category: true,
      status: true,
      isPublic: true,
      views: true,
      saves: true,
      shares: true,
      // Include rooms and selections for Designer Board
      rooms: {
        include: {
          selections: {
            orderBy: { createdAt: 'desc' }
          }
        }
      },
    },
  });

  if (!base) {
    console.warn('[project-detail] not found by id', { id: params.id });
    notFound();
  }

  // Some data sets still have designerId; try to read it but don't fail if column doesn't exist
  let designerId: string | null = null;
  try {
    const extra = (await prisma.project.findUnique({
      where: { id: params.id },
      // @ts-ignore — ignore if the column doesn't exist in this schema
      select: { designerId: true },
    } as any)) as any;
    designerId = extra?.designerId ?? null;
  } catch {}

  const isOwner =
    viewerRole === 'ADMIN' ||
    (!!viewerId && (viewerId === base.ownerId || (!!designerId && viewerId === designerId)));

  if (!isOwner) {
    console.warn('[project-detail] forbidden', { projectId: base.id, viewerId, viewerRole, ownerId: base.ownerId, designerId });
    // Use 404 for now to avoid leaking; later swap to a 403 page
    notFound();
  }

  // Determine current view from search params - default to 'boards'
  const currentView: TabView = (searchParams.view as TabView) || 'boards';
  
  // Validate view parameter
  const validViews: TabView[] = ['overview', 'media', 'boards'];
  const view = validViews.includes(currentView) ? currentView : 'boards';

  // Convert Prisma Decimal objects to numbers for client components
  const sanitizedProject = {
    ...base,
    rooms: base.rooms.map(room => ({
      ...room,
      selections: room.selections.map(selection => ({
        ...selection,
        unitPrice: selection.unitPrice ? Number(selection.unitPrice) : null,
      }))
    }))
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStageLabel = (stage: string) => {
    const stageLabels: Record<string, string> = {
      concept: 'Concept',
      schematic: 'Schematic',
      design_development: 'Design Development',
      cd_pre_spec: 'CD Pre-Spec',
      spec_locked: 'Spec Locked',
      in_procurement: 'In Procurement',
      install: 'Install'
    };
    return stageLabels[stage] || stage;
  };

  const getProjectTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      UNSPECIFIED: 'Unspecified',
      RESIDENTIAL: 'Residential',
      COMMERCIAL: 'Commercial',
      HOSPITALITY: 'Hospitality',
      RETAIL: 'Retail',
      OFFICE: 'Office',
      HEALTHCARE: 'Healthcare',
      EDUCATIONAL: 'Educational',
      INDUSTRIAL: 'Industrial',
      LANDSCAPE: 'Landscape',
      INTERIOR: 'Interior',
      ARCHITECTURAL: 'Architectural'
    };
    return typeLabels[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Back Button */}
      <div className="p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <Link href="/projects" className="flex items-center text-blue-600 hover:underline">
            <FaArrowLeft className="mr-2" /> Back to Projects
          </Link>
        </div>
      </div>

      {/* Project Hero Section - Fixed height with Overview menu */}
      <ProjectHero project={sanitizedProject} />

      {/* Tab Navigation */}
      <ProjectTabs project={sanitizedProject} currentView={view} />

      {/* Main Content */}
      <main className="container mx-auto p-8 grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Main Content Column */}
        <div className="lg:col-span-3">
          {view === 'media' && (
            <MediaSection project={sanitizedProject} isOwner={isOwner} />
          )}
          
          {/* Default to boards view */}
          {(view === 'boards' || view === 'overview') && (
            <div className="bg-white p-8 rounded-lg shadow-md">
              <DesignerBoard 
                projectId={sanitizedProject.id} 
                project={sanitizedProject}
              />
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <aside className="lg:col-span-1 space-y-8">
          {/* Project Actions */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Actions</h2>
            <div className="space-y-3">
              <ProjectMediaManager project={sanitizedProject} isOwner={isOwner} />
              
              <button className="flex items-center justify-center gap-2 w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Spec (HTML)
              </button>
              <button className="flex items-center justify-center gap-2 w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Project
              </button>
            </div>
          </div>

          {/* Project Status */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Project Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Visibility:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  sanitizedProject.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {sanitizedProject.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Category:</span>
                <span className="text-gray-600">{sanitizedProject.category || 'Uncategorized'}</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
} 