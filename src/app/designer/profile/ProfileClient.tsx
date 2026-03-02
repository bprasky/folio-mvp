'use client';

import { useState } from 'react';
import ProfileHero from './ProfileHero';
import ProfileTabs, { type TabId } from './ProfileTabs';
import AllFeed from './tabs/AllFeed';
import ProjectsFeed from './tabs/ProjectsFeed';
import ShopFeed from './tabs/ShopFeed';
import AboutTab from './tabs/AboutTab';
import type { ProfilePageData } from './types';

export default function ProfileClient({ data }: { data: ProfilePageData }) {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const {
    user,
    organization,
    profileInterview,
    projects,
    products,
    teamMembers,
    collaborations,
    projectCount,
    productCount,
    isOwner,
  } = data;

  // Build quotes from profileInterview
  const quotes = [];
  if (profileInterview?.philosophyStatement) {
    quotes.push({
      text: profileInterview.philosophyStatement,
    });
  }
  if (profileInterview?.pullQuotes) {
    profileInterview.pullQuotes.forEach((q, i) => {
      if (i > 0 || !profileInterview.philosophyStatement) {
        quotes.push({ text: q, attribution: `\u2014 ${user.name}` });
      }
    });
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      <ProfileHero
        user={user}
        organization={organization}
        profileInterview={profileInterview}
        projectCount={projectCount}
        productCount={productCount}
        isOwner={isOwner}
      />

      <ProfileTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={{ name: user.name, profileImage: user.profileImage }}
        firmName={organization?.name}
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', paddingBottom: 80 }}>
        {activeTab === 'all' && (
          <AllFeed
            projects={projects}
            products={products}
            teamMembers={teamMembers}
            collaborations={collaborations}
            quotes={quotes}
          />
        )}
        {activeTab === 'projects' && <ProjectsFeed projects={projects} />}
        {activeTab === 'shop' && <ShopFeed products={products} />}
        {activeTab === 'about' && (
          <AboutTab
            user={user}
            profileInterview={profileInterview}
            teamMembers={teamMembers}
            organization={organization}
            isOwner={isOwner}
          />
        )}
      </div>
    </div>
  );
}
