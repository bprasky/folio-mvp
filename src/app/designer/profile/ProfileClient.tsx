'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileHero from './ProfileHero';
import ProfileTabs, { type TabId } from './ProfileTabs';
import ProjectsFeed from './tabs/ProjectsFeed';
import AboutTab from './tabs/AboutTab';
import FolioBadgeModal from '@/components/badge/FolioBadgeModal';
import { getMonographUrl } from '@/lib/utils/getMonographUrl';
import type { ProfilePageData } from './types';

export default function ProfileClient({ data }: { data: ProfilePageData }) {
  const [activeTab, setActiveTab] = useState<TabId>('saves');
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);

  const {
    user,
    organization,
    profileInterview,
    designerBio,
    projects,
    teamMembers,
    saveCount,
    boardCount,
    upcomingEventRSVPs,
    isOwner,
  } = data;

  const monographUrl = getMonographUrl({ name: user.name });
  const tagline = profileInterview?.shortBio || user.bio;

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      <ProfileHero
        user={user}
        organization={organization}
        profileInterview={profileInterview}
        saveCount={saveCount}
        boardCount={boardCount}
        isOwner={isOwner}
        onBadgeClick={() => setBadgeModalOpen(true)}
      />

      <ProfileTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={{ name: user.name, profileImage: user.profileImage }}
        firmName={organization?.name}
        hasOrg={!!organization}
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', paddingBottom: 80 }}>
        {activeTab === 'saves' && <SavesEmptyState />}
        {activeTab === 'boards' && <ProjectsFeed projects={projects} />}
        {activeTab === 'about' && (
          <AboutTab
            user={user}
            profileInterview={profileInterview}
            designerBio={designerBio}
            teamMembers={teamMembers}
            organization={organization}
            isOwner={isOwner}
          />
        )}
      </div>

      <FolioBadgeModal
        open={badgeModalOpen}
        onOpenChange={setBadgeModalOpen}
        user={{ name: user.name, title: user.title, profileImage: user.profileImage }}
        organization={organization ? { name: organization.name } : null}
        tagline={tagline}
        monographUrl={monographUrl}
        upcomingEventRSVPs={upcomingEventRSVPs}
      />
    </div>
  );
}

function SavesEmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '80px 24px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}
      >
        Start saving projects and products you love.
        <br />
        They&rsquo;ll appear here for easy access.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Link
          href="/feed"
          className="accent-btn pill-btn px-6 py-2.5 text-[13px] no-underline inline-block"
        >
          Browse the Feed
        </Link>
        <Link
          href="/directory"
          className="ridge-btn pill-btn px-6 py-2.5 text-[13px] no-underline inline-block"
        >
          Explore the Directory
        </Link>
      </div>
    </div>
  );
}
