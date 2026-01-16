import React from 'react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getVendorContext } from '@/lib/auth/vendorContext';
import { vendorProjectsWhereDemo } from '@/lib/visibility/vendorProjects';
import VendorDashboardClient from './VendorDashboardClient';
import { VendorDashboardShell } from '@/components/vendor/VendorDashboardShell';
import VendorAnalyticsDashboard from '@/components/vendor/VendorAnalyticsDashboard';
import { flags } from '@/lib/flags';
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
        <h2 className="folio-h2">No vendor organizations found</h2>
        <p className="folio-body text-[var(--text-secondary)]">
          Ask an admin to add you to a vendor organization, or create one if your role allows it.
        </p>
      </div>
    );
  }

  return (
    <form action="/vendor/dashboard/set-view-as" method="POST" className="max-w-md mx-auto p-6 space-y-4">
      <label className="block folio-body">Select vendor organization</label>
      <select name="view_as_org" className="ridge-input w-full p-2">
        {memberships.map(m => (
          <option key={m.organizationId} value={m.organizationId}>{m.organization.name}</option>
        ))}
      </select>
      <button className="accent-btn px-4 py-2" type="submit">View</button>
    </form>
  );
}

export default async function VendorDashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <div className="p-8 folio-body">Please sign in.</div>;

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

  // Feature flag: render question-led analytics dashboard if enabled
  // Check environment variable directly (server-side)
  const questionLedEnabled = process.env.NEXT_PUBLIC_FLAG_VENDOR_QUESTION_LED === '1';
  const flagEnabled = process.env.NEXT_PUBLIC_FLAG_VENDOR_NEW_DASHBOARD === '1' || flags.vendorNewDashboard;
  
  // Use question-led dashboard when flag is enabled, or as default for new dashboard
  if (questionLedEnabled || flagEnabled) {
    return (
      <section className="p-8 space-y-6 -mx-6 -mt-0 bg-[var(--bg-base)]">
        <div className="mx-6">
          <h1 className="folio-h1 mb-6">Vendor Dashboard</h1>
          <VendorAnalyticsDashboard />
        </div>
      </section>
    );
  }

  // Existing dashboard (fallback)
  return (
    <section className="p-8 space-y-6 bg-[var(--bg-base)]">
      <h1 className="folio-h1">Vendor Dashboard</h1>
      <p className="folio-body text-[var(--text-secondary)]">
        Showing projects you own or have selections on.
      </p>
      <VendorDashboardClient
        user={{
          id: session.user.id,
          name: session.user.name || '',
          email: session.user.email || '',
          role: session.user.role || 'user',
        }}
        projects={recentProjects as any}
        stats={stats}
      />
    </section>
  );
}
