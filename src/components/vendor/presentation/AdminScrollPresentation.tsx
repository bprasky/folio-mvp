'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import ScrollSection from './ScrollSection';
import LiveMetric from './LiveMetric';
import DesignerCard from './DesignerCard';
import GatedContent from './GatedContent';
import FoundingCounter from './FoundingCounter';
import { useScrollTracking } from '@/hooks/useScrollTracking';

interface Designer {
  id: string;
  name: string;
  profileImage: string | null;
  location: string | null;
  followerCount: number;
  projectCount: number;
  tags: {
    productName: string;
    projectName: string;
    projectId: string;
    quote: string | null;
    taggedAt: string;
  }[];
}

interface VendorStats {
  productsTagged: number;
  uniqueDesigners: number;
  projectsFeaturedIn: number;
  designerReach: number;
  teamMembersOnFolio: number;
  repsClaimedTags: number;
  isAdminActivated: boolean;
  isFoundingVendor: boolean;
}

interface FoundingProgram {
  totalSlots: number;
  invitesSent: number;
  spotsRemaining: number;
  isEligible: boolean;
  currentSlot: number | null;
  isFoundingVendor: boolean;
}

interface AdminScrollPresentationProps {
  organizationId: string;
  organizationName: string;
}

export default function AdminScrollPresentation({
  organizationId,
  organizationName,
}: AdminScrollPresentationProps) {
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [foundingProgram, setFoundingProgram] = useState<FoundingProgram | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const designerScrollRef = useRef<HTMLDivElement>(null);

  const { sectionRef, trackCTA } = useScrollTracking(organizationId, 'admin');

  // Fetch all data
  useEffect(() => {
    Promise.all([
      fetch('/api/vendor/invite-stats').then((r) => r.json()),
      fetch('/api/vendor/designers').then((r) => r.json()),
      fetch('/api/vendor/founding-program').then((r) => r.json()),
    ])
      .then(([statsData, designersData, foundingData]) => {
        setStats(statsData);
        setDesigners(designersData.designers || []);
        setFoundingProgram(foundingData);
        setIsActivated(!!statsData.isAdminActivated);
      })
      .catch(console.error);
  }, []);

  const handleActivate = async () => {
    if (isActivating) return;
    setIsActivating(true);
    trackCTA('activate');

    try {
      const res = await fetch('/api/vendor/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) {
        setIsActivated(true);
        // Refresh data
        const [statsData, designersData] = await Promise.all([
          fetch('/api/vendor/invite-stats').then((r) => r.json()),
          fetch('/api/vendor/designers').then((r) => r.json()),
        ]);
        setStats(statsData);
        setDesigners(designersData.designers || []);
      }
    } catch (error) {
      console.error('Failed to activate:', error);
    } finally {
      setIsActivating(false);
    }
  };

  const handleClaimFoundingSlot = async () => {
    trackCTA('claim-founding');

    try {
      const res = await fetch('/api/vendor/founding-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (res.ok) {
        const updated = await fetch('/api/vendor/founding-program').then((r) => r.json());
        setFoundingProgram(updated);
      }
    } catch (error) {
      console.error('Failed to claim founding slot:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">

      {/* Section 1: The Opening — Full-bleed hero */}
      <ScrollSection
        id="opening"
        trackRef={sectionRef('opening')}
        animation="fade-in"
        fullBleed
        bg="dark"
      >
        <div className="mx-auto max-w-5xl px-6 py-28 md:py-36 text-center">
          <motion.p
            className="text-folio-meta tracking-widest uppercase text-white/60 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {organizationName}
          </motion.p>

          <motion.h1
            className="font-[var(--font-headline)] text-4xl md:text-6xl lg:text-7xl text-white mb-8 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {stats ? (
              <>
                <span className="text-[var(--accent)]">{stats.uniqueDesigners}</span>{' '}
                designers are already using your products
              </>
            ) : (
              'Designers are already using your products'
            )}
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Folio captured what trade shows, marketing spend, and CRM tools couldn&apos;t.
            Here&apos;s what we found.
          </motion.p>

          <motion.div
            className="mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto animate-bounce opacity-50"
            >
              <polyline points="7 13 12 18 17 13" />
              <polyline points="7 6 12 11 17 6" />
            </svg>
          </motion.div>
        </div>
      </ScrollSection>

      {/* Section 2: The Blind Spot */}
      <ScrollSection
        id="blind-spot"
        trackRef={sectionRef('blind-spot')}
        animation="fade-up"
      >
        <div className="text-center mb-12">
          <h2 className="font-[var(--font-headline)] text-folio-h2 md:text-folio-h1 text-[var(--text-primary)] mb-6">
            The blind spot in your marketing
          </h2>
          <p className="text-folio-body text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
            You spend on trade shows, showroom visits, and rep programs.
            But do you know which designers are actually specifying your products?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { label: 'Avg. cost per trade show lead', value: '$1,200+', detail: 'Unknown conversion rate' },
            { label: 'Annual showroom investment', value: '$50K+', detail: 'Foot traffic ≠ specification' },
            { label: 'Rep program overhead', value: '15-25%', detail: 'Relationship-dependent' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="bg-[#F5F3EF] rounded-neu p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
                {item.value}
              </div>
              <div className="text-folio-ui text-[var(--text-secondary)] font-medium mb-2">
                {item.label}
              </div>
              <div className="text-folio-meta text-[var(--text-tertiary)]">
                {item.detail}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollSection>

      {/* Section 3: What Folio Captured */}
      <ScrollSection
        id="captured"
        trackRef={sectionRef('captured')}
        animation="fade-up"
        bg="warm"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-12">
          What Folio captured for {organizationName}
        </h2>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
            <LiveMetric value={stats.productsTagged} label="Products Tagged" size="lg" />
            <LiveMetric value={stats.uniqueDesigners} label="Unique Designers" size="lg" />
            <LiveMetric value={stats.projectsFeaturedIn} label="Projects Featured In" size="lg" />
            <LiveMetric value={stats.designerReach} label="Combined Designer Reach" size="lg" />
            <LiveMetric value={stats.teamMembersOnFolio} label="Team Members on Folio" size="lg" />
            <LiveMetric value={stats.repsClaimedTags} label="Reps Who Claimed Tags" size="lg" />
          </div>
        )}

        <p className="text-center text-folio-meta text-[var(--text-tertiary)]">
          Live data — updated as designers tag your products
        </p>
      </ScrollSection>

      {/* Section 4: How This Happened */}
      <ScrollSection
        id="how"
        trackRef={sectionRef('how')}
        animation="fade-up"
      >
        <div className="text-center mb-12">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] mb-4">
            How this happened
          </h2>
          <p className="text-folio-body text-[var(--text-secondary)] max-w-2xl mx-auto">
            Folio is the operating platform for interior designers. When they document
            their projects, they tag the products they used — including yours.
          </p>
        </div>

        <div className="space-y-8 max-w-2xl mx-auto">
          {[
            {
              title: 'Designer creates project',
              description: 'Uploads photos and documents their design decisions.',
            },
            {
              title: 'Tags products used',
              description: 'Pins product tags to specific locations in project images.',
            },
            {
              title: 'Attribution flows automatically',
              description: 'Your brand is credited. Their followers see it. You get notified.',
            },
            {
              title: 'Listed in the Folio directory',
              description: 'Your products appear in the industry\'s design-driven product directory.',
            },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              className="flex gap-6 items-start"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="text-folio-ui font-semibold text-[var(--text-primary)] mb-1">
                  {step.title}
                </h3>
                <p className="text-folio-body text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollSection>

      {/* Section 5: Meet Your Designers — Horizontal carousel */}
      <ScrollSection
        id="designers"
        trackRef={sectionRef('designers')}
        animation="fade-up"
        bg="elevated"
        fullBleed
      >
        <div className="mx-auto max-w-4xl px-6 mb-8">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-4">
            Meet your designers
          </h2>
          <p className="text-folio-body text-[var(--text-secondary)] text-center">
            {isActivated
              ? `These ${designers.length} designers have tagged your products in their projects.`
              : 'Activate your account to see who\'s specifying your products.'}
          </p>
        </div>

        <GatedContent
          isGated={!isActivated}
          message="Activate your vendor account to see designer identities and project details"
          ctaLabel={isActivating ? 'Activating...' : 'Activate Now'}
          onCTA={handleActivate}
        >
          <div
            ref={designerScrollRef}
            className="flex gap-6 overflow-x-auto px-6 pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {designers.length > 0 ? (
              designers.map((designer) => (
                <div key={designer.id} className="snap-start flex-shrink-0">
                  <DesignerCard
                    name={designer.name}
                    profileImage={designer.profileImage}
                    location={designer.location}
                    followerCount={designer.followerCount}
                    projectCount={designer.projectCount}
                    quote={designer.tags[0]?.quote ?? null}
                    productName={designer.tags[0]?.productName}
                    projectName={designer.tags[0]?.projectName}
                    isGated={!isActivated}
                  />
                </div>
              ))
            ) : (
              // Placeholder cards
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="snap-start flex-shrink-0">
                  <DesignerCard
                    name={`Designer ${i + 1}`}
                    profileImage={null}
                    location="Location hidden"
                    followerCount={Math.floor(Math.random() * 5000)}
                    projectCount={Math.floor(Math.random() * 20) + 1}
                    quote={null}
                    isGated={true}
                  />
                </div>
              ))
            )}
          </div>
        </GatedContent>
      </ScrollSection>

      {/* Section 6: The Influence Map */}
      <ScrollSection
        id="influence-map"
        trackRef={sectionRef('influence-map')}
        animation="fade-up"
      >
        <div className="text-center">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] mb-4">
            Your influence map
          </h2>
          <p className="text-folio-body text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
            See how your products flow through the design community. Every tag creates
            a connection in your network.
          </p>
        </div>

        <GatedContent
          isGated={!isActivated}
          message="Activate to unlock your full influence network"
          ctaLabel={isActivating ? 'Activating...' : 'Activate Now'}
          onCTA={handleActivate}
        >
          {/* Network visualization teaser */}
          <div className="relative aspect-[16/9] bg-[#F5F3EF] rounded-neu-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Abstract network visualization */}
              <svg viewBox="0 0 400 250" className="w-full h-full p-8 opacity-60">
                {/* Nodes */}
                <circle cx="200" cy="125" r="20" fill="var(--accent)" opacity="0.8" />
                <circle cx="100" cy="80" r="12" fill="#1A1A1A" opacity="0.6" />
                <circle cx="300" cy="80" r="14" fill="#1A1A1A" opacity="0.6" />
                <circle cx="80" cy="170" r="10" fill="#1A1A1A" opacity="0.4" />
                <circle cx="320" cy="160" r="11" fill="#1A1A1A" opacity="0.4" />
                <circle cx="150" cy="40" r="8" fill="#1A1A1A" opacity="0.3" />
                <circle cx="260" cy="200" r="9" fill="#1A1A1A" opacity="0.3" />
                <circle cx="50" cy="120" r="7" fill="#1A1A1A" opacity="0.2" />
                <circle cx="350" cy="120" r="8" fill="#1A1A1A" opacity="0.2" />
                {/* Edges */}
                <line x1="200" y1="125" x2="100" y2="80" stroke="#D4CFC8" strokeWidth="1.5" />
                <line x1="200" y1="125" x2="300" y2="80" stroke="#D4CFC8" strokeWidth="1.5" />
                <line x1="200" y1="125" x2="80" y2="170" stroke="#D4CFC8" strokeWidth="1" />
                <line x1="200" y1="125" x2="320" y2="160" stroke="#D4CFC8" strokeWidth="1" />
                <line x1="100" y1="80" x2="150" y2="40" stroke="#D4CFC8" strokeWidth="0.8" />
                <line x1="300" y1="80" x2="260" y2="200" stroke="#D4CFC8" strokeWidth="0.8" />
                <line x1="80" y1="170" x2="50" y2="120" stroke="#D4CFC8" strokeWidth="0.6" />
                <line x1="320" y1="160" x2="350" y2="120" stroke="#D4CFC8" strokeWidth="0.6" />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="font-[var(--font-headline)] text-2xl text-[var(--text-primary)]">
                  {stats ? stats.uniqueDesigners : '...'} connections
                </p>
                <p className="text-folio-meta text-[var(--text-tertiary)]">
                  and growing
                </p>
              </div>
            </div>
          </div>
        </GatedContent>
      </ScrollSection>

      {/* Section 7: Events, Transformed */}
      <ScrollSection
        id="events"
        trackRef={sectionRef('events')}
        animation="fade-up"
        bg="warm"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-4">
          Events, transformed
        </h2>
        <p className="text-folio-body text-[var(--text-secondary)] text-center max-w-2xl mx-auto mb-12">
          Stop guessing who to invite. Know exactly which designers are already
          specifying your products.
        </p>

        {/* Before / After split */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            className="bg-white rounded-neu p-6"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-folio-meta uppercase tracking-wide text-[var(--text-tertiary)] font-medium mb-4">
              Before Folio
            </div>
            <ul className="space-y-3 text-folio-body text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-tertiary)]">-</span>
                Generic invite lists from outdated CRMs
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-tertiary)]">-</span>
                No way to know who actually specs your products
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-tertiary)]">-</span>
                Post-event follow-up with unqualified leads
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-tertiary)]">-</span>
                ROI measured in business cards collected
              </li>
            </ul>
          </motion.div>

          <motion.div
            className="bg-[var(--text-primary)] rounded-neu p-6 text-white"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-folio-meta uppercase tracking-wide text-white/60 font-medium mb-4">
              With Folio
            </div>
            <ul className="space-y-3 text-folio-body text-white/80">
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">+</span>
                Invite designers who already use your products
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">+</span>
                Live attribution: see specs in real-time
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">+</span>
                Warm introductions based on actual product usage
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--accent)]">+</span>
                ROI measured in specifications and conversions
              </li>
            </ul>
          </motion.div>
        </div>
      </ScrollSection>

      {/* Section 8: What Trade Shows Can't Deliver */}
      <ScrollSection
        id="comparison"
        trackRef={sectionRef('comparison')}
        animation="fade-up"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-12">
          What trade shows can&apos;t deliver
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[#E8E4DF]">
                <th className="text-left py-4 px-4 text-folio-ui text-[var(--text-tertiary)] font-medium w-1/3">
                  Feature
                </th>
                <th className="text-center py-4 px-4 text-folio-ui text-[var(--text-tertiary)] font-medium">
                  Trade Shows
                </th>
                <th className="text-center py-4 px-4 text-folio-ui font-semibold text-[var(--accent)]">
                  Folio
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Designer attribution', show: false, folio: true },
                { feature: 'Product spec tracking', show: false, folio: true },
                { feature: 'Live analytics', show: false, folio: true },
                { feature: 'Designer influence data', show: false, folio: true },
                { feature: 'Year-round visibility', show: false, folio: true },
                { feature: 'Face-to-face networking', show: true, folio: false },
                { feature: 'Physical product display', show: true, folio: false },
              ].map((row) => (
                <tr key={row.feature} className="border-b border-[#F5F3EF]">
                  <td className="py-3 px-4 text-folio-body text-[var(--text-primary)]">
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.show ? (
                      <span className="text-[var(--accent)]">&#10003;</span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">&#10005;</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.folio ? (
                      <span className="text-[var(--accent)]">&#10003;</span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">&#10005;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollSection>

      {/* Section 9: Your Voice */}
      <ScrollSection
        id="voice"
        trackRef={sectionRef('voice')}
        animation="fade-up"
        bg="elevated"
      >
        <div className="text-center mb-8">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] mb-4">
            Your voice in the conversation
          </h2>
          <p className="text-folio-body text-[var(--text-secondary)] max-w-2xl mx-auto">
            Folio&apos;s editorial platform lets vendors collaborate on content with
            designers. Co-create stories that feature your products in real projects.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <motion.div
            className="bg-white rounded-neu p-6 shadow-neu-raised"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-folio-ui font-semibold text-[var(--text-primary)] mb-2">
              Sponsored Content
            </h3>
            <p className="text-folio-meta text-[var(--text-secondary)]">
              Feature your products in designer stories. Authentic content,
              real projects, genuine endorsement.
            </p>
          </motion.div>

          <motion.div
            className="bg-white rounded-neu p-6 shadow-neu-raised"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-folio-ui font-semibold text-[var(--text-primary)] mb-2">
              Co-created Editorials
            </h3>
            <p className="text-folio-meta text-[var(--text-secondary)]">
              Partner with Folio editors to produce high-quality content
              that reaches the design community.
            </p>
          </motion.div>
        </div>
      </ScrollSection>

      {/* Section 10: Partnership Options */}
      <ScrollSection
        id="partnership"
        trackRef={sectionRef('partnership')}
        animation="fade-up"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-12">
          Partnership options
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              tier: 'Free',
              description: 'See your tags and basic metrics',
              features: [
                'Product tag notifications',
                'Basic tag counts',
                'Claim your vendor page',
                'Team member invites',
              ],
              cta: 'Current Plan',
              highlighted: false,
            },
            {
              tier: 'Professional',
              description: 'Full analytics and designer access',
              features: [
                'Everything in Free',
                'Designer identity & contact',
                'Influence map & analytics',
                'Event smart-invites',
                'Editorial collaboration',
                'Priority in directory',
              ],
              cta: 'Upgrade',
              highlighted: true,
            },
            {
              tier: 'Enterprise',
              description: 'Custom solutions for large brands',
              features: [
                'Everything in Professional',
                'Dedicated account manager',
                'Custom analytics dashboard',
                'API access for CRM integration',
                'Multi-brand management',
                'White-glove onboarding',
              ],
              cta: 'Contact Sales',
              highlighted: false,
            },
          ].map((plan, i) => (
            <motion.div
              key={plan.tier}
              className={`rounded-neu p-6 ${
                plan.highlighted
                  ? 'bg-[var(--text-primary)] text-white ring-2 ring-[var(--accent)] ring-offset-4'
                  : 'bg-[#F5F3EF]'
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className={`text-xl font-semibold mb-2 ${plan.highlighted ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                {plan.tier}
              </h3>
              <p className={`text-folio-meta mb-4 ${plan.highlighted ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>
                {plan.description}
              </p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={`text-folio-meta flex items-start gap-2 ${plan.highlighted ? 'text-white/80' : 'text-[var(--text-secondary)]'}`}
                  >
                    <span className={plan.highlighted ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}>
                      &#10003;
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => trackCTA(`partnership-${plan.tier.toLowerCase()}`)}
                className={`w-full py-2.5 rounded-neu-btn font-medium text-folio-ui transition-colors ${
                  plan.highlighted
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                    : 'bg-white text-[var(--text-primary)] hover:bg-[#E8E4DF]'
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </ScrollSection>

      {/* Section 11: Founding Vendor Program */}
      <ScrollSection
        id="founding"
        trackRef={sectionRef('founding')}
        animation="fade-up"
        bg="warm"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-[var(--text-primary)] text-center mb-4">
          Founding Vendor Program
        </h2>
        <p className="text-folio-body text-[var(--text-secondary)] text-center max-w-2xl mx-auto mb-12">
          Limited to 20 vendors. Founding vendors receive permanent priority placement,
          early feature access, and a direct line to the Folio team.
        </p>

        {foundingProgram && (
          <div className="max-w-xl mx-auto">
            <FoundingCounter
              totalSlots={foundingProgram.totalSlots}
              spotsRemaining={foundingProgram.spotsRemaining}
              invitesSent={foundingProgram.invitesSent}
              isEligible={foundingProgram.isEligible}
              currentSlot={foundingProgram.currentSlot}
              onClaim={handleClaimFoundingSlot}
            />
          </div>
        )}
      </ScrollSection>

      {/* Section 12: The Close */}
      <ScrollSection
        id="close"
        trackRef={sectionRef('close')}
        animation="fade-in"
        fullBleed
        bg="dark"
      >
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32 text-center">
          <motion.h2
            className="font-[var(--font-headline)] text-3xl md:text-5xl text-white mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {stats ? (
              <>
                {stats.uniqueDesigners} designers.{' '}
                {stats.productsTagged} tags.{' '}
                <span className="text-[var(--accent)]">Your move.</span>
              </>
            ) : (
              <>
                Designers are waiting.{' '}
                <span className="text-[var(--accent)]">Your move.</span>
              </>
            )}
          </motion.h2>

          <motion.p
            className="text-lg text-white/70 mb-10 max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Activate your vendor account to unlock designer identities,
            full analytics, and the founding vendor program.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            {!isActivated ? (
              <button
                onClick={() => {
                  trackCTA('activate-final');
                  handleActivate();
                }}
                disabled={isActivating}
                className="px-8 py-4 bg-[var(--accent)] text-white rounded-neu-btn font-medium text-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {isActivating ? 'Activating...' : 'Activate Your Account'}
              </button>
            ) : (
              <a
                href="/vendor/dashboard"
                onClick={() => trackCTA('dashboard-final')}
                className="px-8 py-4 bg-[var(--accent)] text-white rounded-neu-btn font-medium text-lg hover:bg-[var(--accent-hover)] transition-colors inline-block"
              >
                Go to Dashboard
              </a>
            )}
            <a
              href="mailto:hello@folio.design"
              onClick={() => trackCTA('contact-final')}
              className="px-8 py-4 bg-white/10 text-white rounded-neu-btn font-medium text-lg hover:bg-white/20 transition-colors"
            >
              Talk to Our Team
            </a>
          </motion.div>
        </div>
      </ScrollSection>
    </div>
  );
}
