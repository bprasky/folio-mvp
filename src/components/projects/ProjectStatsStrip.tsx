import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export default async function ProjectStatsStrip() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  // Get project counts for the current designer
  const [totalProjects, publishedProjects, draftProjects, totalRooms] = await Promise.all([
    prisma.project.count({
      where: {
        OR: [
          { ownerId: session.user.id },
          { designerId: session.user.id }
        ]
      }
    }),
    prisma.project.count({
      where: {
        OR: [
          { ownerId: session.user.id },
          { designerId: session.user.id }
        ],
        status: 'published'
      }
    }),
    prisma.project.count({
      where: {
        OR: [
          { ownerId: session.user.id },
          { designerId: session.user.id }
        ],
        status: 'draft'
      }
    }),
    prisma.projectImage.count({
      where: {
        project: {
          OR: [
            { ownerId: session.user.id },
            { designerId: session.user.id }
          ]
        }
      }
    })
  ]);

  const stats = [
    { label: 'Total Projects', value: totalProjects, icon: '📁' },
    { label: 'Published', value: publishedProjects, icon: '✅' },
    { label: 'Drafts', value: draftProjects, icon: '📝' },
    { label: 'Total Images', value: totalRooms, icon: '🖼️' }
  ];

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                <div className="text-sm text-neutral-600">{stat.label}</div>
              </div>
              <div className="text-2xl opacity-60">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}







