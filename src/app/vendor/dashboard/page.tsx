import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getVendorContext } from '@/lib/auth/vendorContext';
import { vendorProjectsWhereDemo } from '@/lib/visibility/vendorProjects';
import VendorDashboardClient from './VendorDashboardClient';
import { cookies } from 'next/headers';
import { 
  FaPlus, 
  FaEye, 
  FaEdit, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaChartLine,
  FaUsers,
  FaCalendarAlt,
  FaArrowRight,
  FaBell,
  FaSearch
} from 'react-icons/fa';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  lastActivity?: string;
  designerOrgName?: string;
  designerEmail?: string;
  vendorOrgName?: string;
  isHandoffReady: boolean;
  handoffInvitedAt?: string;
  handoffClaimedAt?: string;
  rooms: Room[];
  aiSummary?: string;
  nextAction?: string;
  followUpDue?: string;
}

interface Room {
  id: string;
  name: string;
  selections: Selection[];
}

interface Selection {
  id: string;
  productName?: string;
  vendorName?: string;
  unitPrice?: number;
  quantity?: number;
  notes?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DashboardStats {
  activeProjects: number;
  projectsSentToDesigners: number;
  projectsClaimedByDesigners: number;
  openFollowUps: number;
  recentWins: number;
}

async function VendorPicker() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const memberships = await prisma.organizationUser.findMany({
    where: { userId: session.user.id, isActive: true, organization: { type: "VENDOR" } },
    select: { organizationId: true, organization: { select: { id: true, name: true } } },
    // Stable UX: alphabetical by organization name
    orderBy: { organization: { name: "asc" } },
  });

  if (!memberships.length) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-3 p-8">
        <h2 className="text-2xl font-serif">No vendor organizations found</h2>
        <p className="text-sm text-muted-foreground">
          Ask an admin to add you to a vendor organization, or create one if your role allows it.
        </p>
      </div>
    );
  }

  return (
    <form action="/vendor/dashboard/set-view-as" method="POST" className="max-w-md mx-auto p-6 space-y-4">
      <label className="block text-sm">Select vendor organization</label>
      <select name="view_as_org" className="w-full border rounded-lg p-2">
        {memberships.map(m => (
          <option key={m.organizationId} value={m.organizationId}>{m.organization.name}</option>
        ))}
      </select>
      <button className="px-4 py-2 rounded-lg border" type="submit">View</button>
    </form>
  );
}

export default async function VendorDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <div className="p-8">Please sign in.</div>;

  const where = vendorProjectsWhereDemo(session.user.id);

  const [totalProjects, recentProjects] = await Promise.all([
    prisma.project.count({ where }), // ✅ fixed
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { 
        _count: { select: { selections: true } },
        rooms: {
          include: {
            selections: true
          }
        }
      },
    }),
  ]);

  // Calculate stats
  const activeProjects = totalProjects;
  const projectsSentToDesigners = recentProjects.filter((p: any) => p.isHandoffReady).length;
  const projectsClaimedByDesigners = recentProjects.filter((p: any) => p.handoffClaimedAt).length;
  const openFollowUps = recentProjects.filter((p: any) => p.followUpDue).length;
  
  const stats = {
    activeProjects,
    projectsSentToDesigners,
    projectsClaimedByDesigners,
    openFollowUps,
    recentWins: Math.floor(projectsClaimedByDesigners * 0.3) // Mock calculation
  };

  return (
    <section className="p-8 space-y-6">
      <h1 className="text-3xl font-serif">Vendor Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Showing projects you own or have selections on.
      </p>
      <VendorDashboardClient 
        user={session.user}
        projects={recentProjects}
        stats={stats}
      />
    </section>
  );
}
