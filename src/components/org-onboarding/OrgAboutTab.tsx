'use client';

import { useState } from 'react';
import { EmptyStateCard } from './EmptyStateCard';
import { ProfileCompletenessIndicator } from './ProfileCompletenessIndicator';
import { BioInterviewModal } from './BioInterviewModal';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { StudioDetailsModal } from './StudioDetailsModal';
import { ProcessBuilderModal } from './ProcessBuilderModal';
import { RecognitionModal } from './RecognitionModal';
import SafeImage from '@/components/SafeImage';
import {
  MessageSquareText,
  Users,
  Settings,
  Workflow,
  Award
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  headshotUrl?: string | null;
  bio?: string | null;
}

interface ProcessPhase {
  id: string;
  name: string;
  description?: string | null;
  order: number;
}

interface Recognition {
  id: string;
  type: string;
  title: string;
  source: string;
  date?: Date | null;
  url?: string | null;
}

interface OrgAboutTabProps {
  org: {
    id: string;
    name: string;
    description?: string | null;
    website?: string | null;
    address?: string | null;
    philosophy?: string | null;
    foundedYear?: number | null;
    teamSizeRange?: string | null;
    services?: string[];
    projectTypes?: string[];
    serviceRegions?: string[];
    memberships?: string[];
    certifications?: string[];
  };
  team: TeamMember[];
  processPhases?: ProcessPhase[];
  recognition?: Recognition[];
  onboardingProgress: {
    bioInterviewComplete: boolean;
    studioDetailsComplete: boolean;
    teamSetupComplete: boolean;
    processComplete: boolean;
    recognitionComplete: boolean;
    pinnedWorkComplete: boolean;
  };
  isOwner: boolean;
}

export function OrgAboutTab({
  org,
  team,
  processPhases = [],
  recognition = [],
  onboardingProgress,
  isOwner
}: OrgAboutTabProps) {
  const [showBioInterview, setShowBioInterview] = useState(false);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [showStudioDetails, setShowStudioDetails] = useState(false);
  const [showProcessBuilder, setShowProcessBuilder] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);

  const refresh = () => {
    window.location.reload();
  };

  // If bio is not complete, show the primary CTA
  if (!onboardingProgress.bioInterviewComplete && isOwner) {
    return (
      <div className="space-y-8">
        <EmptyStateCard
          icon={<MessageSquareText className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
          title="Tell your studio's story"
          description="Answer a few questions and we'll help craft your bio, tagline, and philosophy."
          buttonText="Start Bio Interview"
          onAction={() => setShowBioInterview(true)}
          estimatedTime="5 minutes"
        />

        <BioInterviewModal
          open={showBioInterview}
          onClose={() => setShowBioInterview(false)}
          orgId={org.id}
          orgName={org.name}
          onComplete={refresh}
        />
      </div>
    );
  }

  // Bio is complete, show progressive empty states for remaining items
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left column - Bio & Details */}
      <div className="md:col-span-2 space-y-8">
        {/* Philosophy Quote */}
        {org.philosophy && (
          <div
            className="text-center py-8 mb-4"
            style={{ borderBottom: '1px solid #E8E4DF' }}
          >
            <blockquote
              className="text-xl md:text-2xl italic max-w-2xl mx-auto"
              style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
            >
              "{org.philosophy}"
            </blockquote>
            <p className="mt-4 text-sm" style={{ color: '#8B8178' }}>
              — {org.name}
            </p>
          </div>
        )}

        {/* Bio section */}
        <div>
          <h2
            className="text-xl mb-4"
            style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
          >
            About
          </h2>
          {org.description ? (
            <p className="whitespace-pre-wrap" style={{ color: '#5C564F' }}>
              {org.description}
            </p>
          ) : (
            <p style={{ color: '#8B8178' }}>No description yet.</p>
          )}
        </div>

        {/* Team section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl"
              style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
            >
              Team
            </h2>
            {isOwner && (
              <button
                onClick={() => setShowAddTeamMember(true)}
                className="text-sm hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Add team member
              </button>
            )}
          </div>

          {team.length === 0 && isOwner ? (
            <EmptyStateCard
              icon={<Users className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
              title="Introduce your team"
              description="Add team members so clients can see who they'll be working with"
              buttonText="Add First Team Member"
              onAction={() => setShowAddTeamMember(true)}
              className="py-6"
            />
          ) : team.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {team.map((member) => (
                <div key={member.id} className="flex gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: '#E8E4DF' }}
                  >
                    {member.headshotUrl ? (
                      <SafeImage
                        src={member.headshotUrl}
                        alt={member.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-lg font-light"
                        style={{ color: '#6B635B' }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2C2825' }}>
                      {member.name}
                    </p>
                    <p className="text-xs" style={{ color: '#8B8178' }}>
                      {member.role}
                    </p>
                    {member.bio && (
                      <p
                        className="text-xs mt-1 line-clamp-2"
                        style={{ color: '#6B635B' }}
                      >
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#8B8178' }}>No team members listed.</p>
          )}
        </div>

        {/* Process section */}
        {processPhases.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl"
                style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
              >
                Our Process
              </h2>
              {isOwner && (
                <button
                  onClick={() => setShowProcessBuilder(true)}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-4">
              {processPhases.map((phase, index) => (
                <div key={phase.id} className="flex gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
                    style={{ backgroundColor: '#E8E4DF', color: '#6B635B' }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#2C2825' }}>
                      {phase.name}
                    </p>
                    {phase.description && (
                      <p className="text-sm mt-1" style={{ color: '#6B635B' }}>
                        {phase.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isOwner && !onboardingProgress.processComplete ? (
          <EmptyStateCard
            icon={<Workflow className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
            title="Show clients what working with you looks like"
            description="Define your design process phases to set expectations"
            buttonText="Build Your Process"
            onAction={() => setShowProcessBuilder(true)}
            className="py-6"
          />
        ) : null}

        {/* Recognition section */}
        {recognition.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl"
                style={{ fontFamily: 'Georgia, serif', color: '#2C2825' }}
              >
                Recognition
              </h2>
              {isOwner && (
                <button
                  onClick={() => setShowRecognition(true)}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Add more
                </button>
              )}
            </div>
            <div className="space-y-3">
              {recognition.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3"
                  style={{ borderBottom: '1px solid #E8E4DF' }}
                >
                  <Award className="w-5 h-5 flex-shrink-0" style={{ color: '#8B8178' }} />
                  <div>
                    <p className="font-medium" style={{ color: '#2C2825' }}>
                      {item.title}
                    </p>
                    <p className="text-sm" style={{ color: '#6B635B' }}>
                      {item.source}
                      {item.date && (
                        <span>
                          {' '}
                          · {new Date(item.date).toLocaleDateString('en-US', { year: 'numeric' })}
                        </span>
                      )}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : isOwner && !onboardingProgress.recognitionComplete ? (
          <EmptyStateCard
            icon={<Award className="w-6 h-6" style={{ color: 'var(--accent)' }} />}
            title="Highlight where your work has been featured"
            description="Add press features, awards, and speaking engagements"
            buttonText="Add Recognition"
            onAction={() => setShowRecognition(true)}
            className="py-6"
          />
        ) : null}
      </div>

      {/* Right column - Sidebar */}
      <div className="space-y-6">
        {isOwner && <ProfileCompletenessIndicator progress={onboardingProgress} />}

        {/* Studio Details Card */}
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ border: '1px solid var(--ridge-outer)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Studio Details</h3>
            {isOwner && (
              <button
                onClick={() => setShowStudioDetails(true)}
                className="text-xs hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Edit
              </button>
            )}
          </div>

          {!onboardingProgress.studioDetailsComplete && isOwner ? (
            <button
              onClick={() => setShowStudioDetails(true)}
              className="w-full text-left text-sm hover:text-foreground"
              style={{ color: 'var(--text-secondary)' }}
            >
              Add details like founding year, team size, services...
            </button>
          ) : (
            <div className="space-y-2 text-sm">
              {org.foundedYear && (
                <DetailRow label="Founded" value={org.foundedYear.toString()} />
              )}
              {org.teamSizeRange && (
                <DetailRow label="Team Size" value={formatTeamSize(org.teamSizeRange)} />
              )}
              {org.services && org.services.length > 0 && (
                <DetailRow label="Services" value={org.services.join(', ')} />
              )}
              {org.serviceRegions && org.serviceRegions.length > 0 && (
                <DetailRow label="Regions" value={org.serviceRegions.join(', ')} />
              )}
              {org.memberships && org.memberships.length > 0 && (
                <DetailRow label="Memberships" value={org.memberships.join(', ')} />
              )}
              {org.certifications && org.certifications.length > 0 && (
                <DetailRow label="Certifications" value={org.certifications.join(', ')} />
              )}
            </div>
          )}
        </div>

        {/* Website link */}
        {org.website && (
          <div className="text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Website</span>
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}

        {/* Address */}
        {org.address && (
          <div className="text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Location</span>
            <p>{org.address}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <BioInterviewModal
        open={showBioInterview}
        onClose={() => setShowBioInterview(false)}
        orgId={org.id}
        orgName={org.name}
        onComplete={refresh}
      />

      <AddTeamMemberModal
        open={showAddTeamMember}
        onClose={() => setShowAddTeamMember(false)}
        orgId={org.id}
        orgName={org.name}
        onSuccess={refresh}
      />

      <StudioDetailsModal
        open={showStudioDetails}
        onClose={() => setShowStudioDetails(false)}
        orgId={org.id}
        initialData={{
          foundedYear: org.foundedYear,
          teamSizeRange: org.teamSizeRange,
          services: org.services,
          projectTypes: org.projectTypes,
          serviceRegions: org.serviceRegions,
          memberships: org.memberships,
          certifications: org.certifications
        }}
        onSuccess={refresh}
      />

      <ProcessBuilderModal
        open={showProcessBuilder}
        onClose={() => setShowProcessBuilder(false)}
        orgId={org.id}
        initialPhases={processPhases}
        onSuccess={refresh}
      />

      <RecognitionModal
        open={showRecognition}
        onClose={() => setShowRecognition(false)}
        orgId={org.id}
        onSuccess={refresh}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between py-2"
      style={{ borderBottom: '1px solid #E8E4DF' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-right max-w-[60%]" style={{ color: '#2C2825' }}>
        {value}
      </span>
    </div>
  );
}

function formatTeamSize(size: string): string {
  const sizes: Record<string, string> = {
    SOLO: 'Solo (1 person)',
    SMALL_2_5: 'Small (2-5)',
    MEDIUM_6_15: 'Medium (6-15)',
    LARGE_16_50: 'Large (16-50)',
    ENTERPRISE_50_PLUS: 'Enterprise (50+)'
  };
  return sizes[size] || size;
}
