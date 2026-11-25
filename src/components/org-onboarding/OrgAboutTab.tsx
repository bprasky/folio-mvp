'use client';

import { useState } from 'react';
import Link from 'next/link';
import forms from '@/components/ui/WorkflowForms.module.css';
import { externalIdentityUrl } from '@/lib/seo/public';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { StudioDetailsModal } from './StudioDetailsModal';
import { ProcessBuilderModal } from './ProcessBuilderModal';
import { RecognitionModal } from './RecognitionModal';
import SafeImage from '@/components/SafeImage';

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
    location?: string | null;
    specialties?: string[];
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
  isOwner: boolean;
  canEditBio?: boolean;
}

export function OrgAboutTab({
  org,
  team,
  processPhases = [],
  recognition = [],
  isOwner,
  canEditBio = false,
}: OrgAboutTabProps) {
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [showStudioDetails, setShowStudioDetails] = useState(false);
  const [showProcessBuilder, setShowProcessBuilder] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);

  const refresh = () => {
    window.location.reload();
  };

  const website = externalIdentityUrl(org.website);
  const facts = [
    ['Based in', org.location], ['Address', org.address !== org.location && org.address],
    ['Founded', org.foundedYear], ['Team size', org.teamSizeRange && formatTeamSize(org.teamSizeRange)],
    ['Specialties', org.specialties?.join(', ')], ['Services', org.services?.join(', ')],
    ['Project types', org.projectTypes?.join(', ')], ['Works in', org.serviceRegions?.join(', ')],
    ['Memberships', org.memberships?.join(', ')], ['Certifications', org.certifications?.join(', ')],
  ].filter(([, value]) => value);
  const hasContent = Boolean(org.description || org.philosophy || team.length || processPhases.length || recognition.length || facts.length || website);
  if (!hasContent && !isOwner && !canEditBio) return <p className="folio-body text-folio-text-secondary">Studio details will appear here.</p>;
  const bioInterview = '/org/' + org.id + '/settings/about-interview';

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="grid gap-8 md:grid-cols-3 md:gap-12">
        <div className="space-y-9 md:col-span-2">
          {org.description && <section><h2 className="folio-h3 mb-3">About the studio</h2>
            <p className="folio-body max-w-prose whitespace-pre-line">{org.description}</p></section>}
          {canEditBio && <section aria-label="Studio bio">
            {!org.description?.trim() && <h2 className="folio-h2 mb-5">Introduce your studio</h2>}
            <div className={forms.actions}>
              <Link className={forms.primary} href={bioInterview + '?mode=import'}>Import a write-up</Link>
              <Link className={forms.secondary} href={'/org/' + org.id + '/edit?section=about'}>{org.description?.trim() ? 'Edit studio bio' : 'Write your bio'}</Link>
              <Link className={forms.secondary} href={bioInterview + '?mode=interview'}>Take the bio interview</Link>
            </div>
          </section>}
          {org.philosophy && org.philosophy !== org.description && <blockquote className="folio-h3 max-w-prose italic">{org.philosophy}</blockquote>}
          {!!team.length && <section><h2 className="folio-h3 mb-4">Team</h2>
            <ul className="grid gap-6 sm:grid-cols-2">{team.map(member => <li key={member.id} className="flex items-start gap-4">
              {member.headshotUrl && <SafeImage src={member.headshotUrl} alt={member.name} width={56} height={56} className="w-14 h-14 object-cover rounded-full" />}
              <div><p className="folio-ui">{member.name}</p><p className="folio-meta text-folio-text-secondary">{member.role}</p>
                {member.bio && <p className="folio-body mt-2">{member.bio}</p>}</div>
            </li>)}</ul></section>}
          {!!processPhases.length && <section><h2 className="folio-h3 mb-3">Our process</h2><ol className="space-y-4 list-decimal pl-5">
            {processPhases.map(phase => <li key={phase.id}><p className="folio-ui">{phase.name}</p>
              {phase.description && <p className="folio-body">{phase.description}</p>}</li>)}</ol></section>}
          {!!recognition.length && <section><h2 className="folio-h3 mb-3">Recognition</h2><ul className="space-y-4">
            {recognition.map(item => <li key={item.id}><p className="folio-ui">{item.url ? <a className="underline underline-offset-4" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</p>
              <p className="folio-meta text-folio-text-secondary">{item.source}{item.date && ' · ' + new Date(item.date).getUTCFullYear()}</p></li>)}</ul></section>}
        </div>
        {(!!facts.length || website) && <aside><h2 className="folio-h3 mb-3">Studio details</h2>
          <dl>{facts.map(([label, value]) => <div key={String(label)} className="py-3 border-t border-folio-border-subtle">
            <dt className="folio-meta text-folio-text-secondary">{label}</dt><dd className="folio-ui">{value}</dd></div>)}</dl>
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-block py-3 underline underline-offset-4">Visit studio website</a>}</aside>}
      </div>
      {isOwner && <details className="border-t border-folio-border-subtle">
        <summary className="folio-ui py-3 cursor-pointer">Edit About section</summary>
        <div className="flex flex-wrap gap-x-6 folio-ui underline underline-offset-4">
          {!canEditBio && <Link className="py-3" href={bioInterview}>Studio bio interview</Link>}
          <button className="py-3" onClick={() => setShowStudioDetails(true)}>Studio details</button>
          <button className="py-3" onClick={() => setShowAddTeamMember(true)}>Add team member</button>
          <button className="py-3" onClick={() => setShowProcessBuilder(true)}>Edit process</button>
          <button className="py-3" onClick={() => setShowRecognition(true)}>Add recognition</button>
        </div>
      </details>}

      {/* Modals */}
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
