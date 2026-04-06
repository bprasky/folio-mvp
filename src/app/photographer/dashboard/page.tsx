'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Settings, Eye, Camera, ExternalLink } from 'lucide-react';

interface DashboardData {
  profile: {
    id: string;
    name: string;
    profileImage: string | null;
    views: number;
  };
  creditedProjects: Array<{
    id: string;
    slug: string;
    publishedAt: string | null;
    projectTitle: string;
    designerName: string | null;
    heroImageUrl: string | null;
  }>;
  profileCompleteness: number;
  stats: {
    profileViews: number;
    creditedProjectCount: number;
  };
}

export default function PhotographerDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      fetchDashboard();
    }
  }, [status, router]);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/photographer/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-tertiary">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-secondary">Unable to load dashboard.</div>
      </div>
    );
  }

  const profileSlug = data.profile.name.replace(/\s+/g, '').toLowerCase();

  return (
    <div className="min-h-screen bg-surface-canvas">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="folio-h2">Dashboard</h1>
            <p className="folio-body text-folio-text-secondary mt-1">
              Welcome back, {data.profile.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/photographer/${profileSlug}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:border-[var(--accent)] transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Profile
            </Link>
            <Link
              href="/photographer/settings"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:border-[var(--accent)] transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>

        {/* Profile completeness */}
        {data.profileCompleteness < 100 && (
          <div className="mb-8 p-4 rounded-xl border border-folio-border-subtle bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-folio-text-primary">
                Profile completeness
              </span>
              <span className="text-sm text-folio-text-secondary">
                {data.profileCompleteness}%
              </span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${data.profileCompleteness}%` }}
              />
            </div>
            <Link
              href="/photographer/settings"
              className="text-xs text-[var(--accent)] hover:underline mt-2 inline-block"
            >
              Complete your profile to attract more designers
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="p-5 rounded-xl border border-folio-border-subtle bg-white">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-folio-text-tertiary" />
              <span className="text-xs text-folio-text-secondary uppercase tracking-wider">
                Profile Views
              </span>
            </div>
            <span className="text-2xl font-light text-folio-text-primary">
              {data.stats.profileViews}
            </span>
          </div>
          <div className="p-5 rounded-xl border border-folio-border-subtle bg-white">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-folio-text-tertiary" />
              <span className="text-xs text-folio-text-secondary uppercase tracking-wider">
                Credited Projects
              </span>
            </div>
            <span className="text-2xl font-light text-folio-text-primary">
              {data.stats.creditedProjectCount}
            </span>
          </div>
        </div>

        {/* Credited Projects */}
        <div>
          <h2 className="text-xs font-semibold text-folio-text-secondary uppercase tracking-widest mb-4">
            Your Credited Projects
          </h2>

          {data.creditedProjects.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-folio-border-subtle">
              <Camera className="w-8 h-8 text-folio-text-tertiary mx-auto mb-3" />
              <p className="text-folio-text-secondary text-sm">
                No credited projects yet. When designers publish projects with your photography, they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.creditedProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/p/${project.slug}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-folio-border-subtle bg-white hover:border-[var(--accent)] transition-colors group"
                >
                  {project.heroImageUrl ? (
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                      <Image
                        src={project.heroImageUrl}
                        alt={project.projectTitle}
                        width={64}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-stone-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-folio-text-primary truncate">
                      {project.projectTitle}
                    </h3>
                    {project.designerName && (
                      <p className="text-xs text-folio-text-secondary mt-0.5">
                        by {project.designerName}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-folio-text-tertiary group-hover:text-[var(--accent)] transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
