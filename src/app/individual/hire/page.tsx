'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaCheck, FaExternalLinkAlt, FaSpinner } from 'react-icons/fa';
import { normalizeRole } from '@/lib/permissions';
import { demoIndividualHireData } from './demoData';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

interface DesignerMatch {
  designerId: string;
  name: string;
  location: string;
  avatarUrl: string;
  offerings: string[];
  styleTags: string[];
  projectRange: {
    minBudget: number;
    maxBudget: number;
    typicalScope: string;
  };
  matchScores: {
    styleOverlap: number;
    projectTierFit: number;
    vendorOverlap: number;
    locationFit: number;
    overallMatch: number;
  };
  reasonChips: string[];
  previewProjects: Array<{
    projectId: string;
    name: string;
    heroImageUrl: string;
    overlappingTags: string[];
  }>;
  cta: {
    primary: {
      label: string;
      action: string;
    };
    secondary?: {
      label: string;
      action: string;
    };
  };
}

export default function IndividualHirePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hiringDesignerId, setHiringDesignerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [designerMatches, setDesignerMatches] = useState<DesignerMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Fetch designer matches
  useEffect(() => {
    const fetchMatches = async () => {
      if (status === 'loading' || !session?.user) return;

      const userRole = normalizeRole(session.user.role);
      if (userRole !== 'INDIVIDUAL') return;

      try {
        setLoadingMatches(true);
        const response = await fetch('/api/individual/match-designers');
        if (response.ok) {
          const data = await response.json();
          setDesignerMatches(data.matches || []);
        } else {
          // Fallback to demo data if API fails
          const { designerMatches: demoMatches } = demoIndividualHireData;
          setDesignerMatches(demoMatches as DesignerMatch[]);
        }
      } catch (err) {
        console.error('[hire] Failed to fetch matches:', err);
        // Fallback to demo data
        const { designerMatches: demoMatches } = demoIndividualHireData;
        setDesignerMatches(demoMatches as DesignerMatch[]);
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatches();
  }, [session, status]);

  // Role gating: redirect if not INDIVIDUAL
  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    const userRole = normalizeRole(session.user.role);
    if (userRole !== 'INDIVIDUAL') {
      // Redirect to appropriate page based on role
      router.push('/');
      return;
    }
  }, [session, status, router]);

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-canvas p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-surface-ground rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-surface-ground rounded w-1/2 mb-8"></div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-surface-ground rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or not INDIVIDUAL
  if (!session?.user || normalizeRole(session.user.role) !== 'INDIVIDUAL') {
    return null;
  }

  const { individual, designerMatches: demoMatches, uiCopy } = demoIndividualHireData;
  const { projectProfile } = individual;
  const { inferredSignals } = projectProfile;

  // Use fetched matches if available, otherwise fallback to demo data
  const matches = designerMatches.length > 0 ? designerMatches : (demoMatches as DesignerMatch[]);

  // Format match score as percentage
  const formatMatchScore = (score: number) => Math.round(score * 100);

  // Format project summary
  const projectSummary = `${inferredSignals.roomCount} ${inferredSignals.roomCount === 1 ? 'room' : 'rooms'} · ${inferredSignals.projectTier.charAt(0).toUpperCase() + inferredSignals.projectTier.slice(1)} project · ${inferredSignals.dominantStyleTags.slice(0, 3).join(' • ')}`;

  // Handle hire action
  const handleHire = async (designerId: string, designerName: string) => {
    setHiringDesignerId(designerId);
    setError(null);

    try {
      // Use the designerId directly (should be a real database ID from the matching API)
      const actualDesignerId = designerId;

      const response = await fetch('/api/individual/hire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designerId: actualDesignerId,
          projectTitle: `Project with ${designerName}`,
          description: `Project created from Individual hire flow`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to hire designer');
      }

      const result = await response.json();

      // Redirect to the project page (Designer view will be accessible)
      if (result.project?.id) {
        router.push(`/project/${result.project.id}`);
      } else {
        router.push('/projects');
      }
    } catch (err: any) {
      console.error('[hire] Error:', err);
      setError(err.message || 'Failed to hire designer. Please try again.');
      setHiringDesignerId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="folio-h1 text-folio-text-primary mb-3">
            {uiCopy.pageTitle}
          </h1>
          <p className="folio-body text-folio-text-secondary mb-6">
            {uiCopy.pageSubtitle}
          </p>

          {/* Project Summary Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-ground rounded-full border border-[var(--border-color)] shadow-sm">
            <span className="folio-ui text-folio-text-secondary">
              {projectSummary}
            </span>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Designer Matches */}
        {loadingMatches ? (
          <div className="flex justify-center items-center py-12">
            <FaSpinner className="w-8 h-8 animate-spin text-folio-text-tertiary" />
          </div>
        ) : (
          <div className="space-y-8 mb-12">
            {matches.map((designer, index) => (
            <motion.div
              key={designer.designerId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <RidgeCard className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Designer Info */}
                  <div className="lg:col-span-1">
                    <div className="flex flex-col items-start mb-6">
                      {/* Avatar */}
                      <div className="relative w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-[var(--border-color)]">
                        <Image
                          src={designer.avatarUrl || '/images/placeholder-avatar.jpg'}
                          alt={designer.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Designer Name & Location */}
                      <h2 className="folio-h2 text-folio-text-primary mb-2">
                        {designer.name}
                      </h2>
                      <div className="flex items-center gap-2 text-folio-text-secondary mb-4">
                        <FaMapMarkerAlt className="w-4 h-4" />
                        <span className="folio-meta">{designer.location}</span>
                      </div>

                      {/* Match Score Badge */}
                      <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 rounded-full">
                          <span className="folio-ui font-semibold text-[var(--accent)]">
                            {formatMatchScore(designer.matchScores.overallMatch)}% Match
                          </span>
                        </div>
                      </div>

                      {/* Offerings */}
                      <div className="mb-6">
                        <h3 className="folio-ui font-semibold text-folio-text-primary mb-2">
                          Services
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {designer.offerings.map((offering, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 folio-meta bg-surface-canvas text-folio-text-secondary rounded-full"
                            >
                              {offering}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Project Range */}
                      <div className="folio-meta text-folio-text-secondary">
                        <p className="font-medium text-folio-text-primary mb-1">
                          Budget Range
                        </p>
                        <p>
                          ${designer.projectRange.minBudget.toLocaleString()} - ${designer.projectRange.maxBudget.toLocaleString()}
                        </p>
                        <p className="mt-1 text-folio-text-tertiary">
                          {designer.projectRange.typicalScope}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Match Details */}
                  <div className="lg:col-span-2">
                    {/* Reason Chips */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {designer.reasonChips.map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full"
                        >
                          <FaCheck className="w-3 h-3 text-green-600" />
                          <span className="folio-meta text-green-800">{reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Preview Projects */}
                    {designer.previewProjects.length > 0 && (
                      <div className="mb-6">
                        <h3 className="folio-ui font-semibold text-folio-text-primary mb-3">
                          Similar Projects
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {designer.previewProjects.slice(0, 2).map((project) => (
                            <div
                              key={project.projectId}
                              className="relative aspect-[4/3] rounded-lg overflow-hidden"
                            >
                              <Image
                                src={project.heroImageUrl || '/images/placeholder-project.jpg'}
                                alt={project.name}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
                                <div className="p-3 text-white">
                                  <p className="folio-meta font-medium">{project.name}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Match Score Breakdown (optional, can be collapsed) */}
                    <div className="mb-6 p-4 bg-surface-canvas rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 folio-meta">
                        <div>
                          <p className="text-folio-text-secondary mb-1">Style</p>
                          <p className="font-semibold text-folio-text-primary">
                            {formatMatchScore(designer.matchScores.styleOverlap)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-folio-text-secondary mb-1">Project Fit</p>
                          <p className="font-semibold text-folio-text-primary">
                            {formatMatchScore(designer.matchScores.projectTierFit)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-folio-text-secondary mb-1">Vendor Overlap</p>
                          <p className="font-semibold text-folio-text-primary">
                            {formatMatchScore(designer.matchScores.vendorOverlap)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-folio-text-secondary mb-1">Location</p>
                          <p className="font-semibold text-folio-text-primary">
                            {formatMatchScore(designer.matchScores.locationFit)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="accent"
                        onClick={() => handleHire(designer.designerId, designer.name)}
                        disabled={hiringDesignerId === designer.designerId}
                        data-demo-id="hire-button"
                      >
                        {hiringDesignerId === designer.designerId ? (
                          <>
                            <FaSpinner className="w-4 h-4 animate-spin mr-2" />
                            Creating Project...
                          </>
                        ) : (
                          designer.cta.primary.label
                        )}
                      </Button>
                      {designer.cta.secondary && (
                        <Link
                          href={designer.cta.secondary.action}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-surface-canvas text-folio-text-secondary rounded-lg border border-[var(--border-color)] hover:bg-surface-ground transition-colors folio-ui"
                        >
                          {designer.cta.secondary.label}
                          <FaExternalLinkAlt className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </RidgeCard>
            </motion.div>
            ))}
          </div>
        )}

        {/* How We Match Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <RidgeCard className="p-8 mb-8">
            <h2 className="folio-h2 text-folio-text-primary mb-4">
              {uiCopy.sections.howWeMatchTitle}
            </h2>
            <p className="folio-body text-folio-text-secondary leading-relaxed max-w-3xl">
              {uiCopy.sections.howWeMatchBody}
            </p>
          </RidgeCard>
        </motion.div>
      </div>
    </div>
  );
}
