'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import ScrollSection from './ScrollSection';
import LiveMetric from './LiveMetric';
import { useScrollTracking } from '@/hooks/useScrollTracking';

interface TriggerTag {
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    brand: string | null;
    price: number | null;
  };
  projectImage: string | null;
  project: { id: string; title: string } | null;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
    companyName: string | null;
    followerCount: number;
  } | null;
  quote: string | null;
  taggedAt: string;
}

interface VendorStats {
  productsTagged: number;
  uniqueDesigners: number;
  projectsFeaturedIn: number;
  designerReach: number;
  teamMembersOnFolio: number;
  repsClaimedTags: number;
  isAdminActivated: boolean;
}

interface RepScrollPresentationProps {
  organizationId: string;
  organizationName: string;
}

export default function RepScrollPresentation({
  organizationId,
  organizationName,
}: RepScrollPresentationProps) {
  const [triggerTag, setTriggerTag] = useState<TriggerTag | null>(null);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);

  const { sectionRef, trackCTA } = useScrollTracking(organizationId, 'rep');

  // Fetch trigger tag and stats
  useEffect(() => {
    fetch('/api/vendor/trigger-tag')
      .then((r) => r.json())
      .then((data) => setTriggerTag(data.triggerTag))
      .catch(console.error);

    fetch('/api/vendor/invite-stats')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(console.error);
  }, []);

  const handleInviteAdmin = async () => {
    if (!inviteEmail || inviting) return;
    setInviting(true);
    trackCTA('invite-admin');

    try {
      const res = await fetch('/api/vendor/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: inviteEmail, organizationId }),
      });
      if (res.ok) {
        setInviteSent(true);
      }
    } catch (error) {
      console.error('Failed to invite admin:', error);
    } finally {
      setInviting(false);
    }
  };

  const designer = triggerTag?.designer;

  return (
    <div className="min-h-screen bg-surface-canvas">

      {/* Section 1: The Hook */}
      <ScrollSection
        id="hook"
        trackRef={sectionRef('hook')}
        animation="fade-in"
        bg="warm"
        fullBleed
      >
        <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
          {/* Designer photo + tag context */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Project image */}
            {triggerTag?.projectImage && (
              <div className="relative w-full md:w-1/2 aspect-[4/3] rounded-neu overflow-hidden shadow-neu-raised-lg">
                <Image
                  src={triggerTag.projectImage}
                  alt={triggerTag.project?.title || 'Project'}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="flex-1">
              {designer?.profileImage && (
                <div className="relative w-16 h-16 rounded-full overflow-hidden mb-4 shadow-neu-raised">
                  <Image
                    src={designer.profileImage}
                    alt={designer.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <h1 className="font-[var(--font-headline)] text-folio-h2 md:text-folio-h1 text-folio-text-primary mb-4">
                {designer?.name || 'A designer'} tagged your {triggerTag?.product?.name || 'product'}
              </h1>

              {triggerTag?.project && (
                <p className="text-folio-body text-folio-text-secondary mb-4">
                  In their project: <strong>{triggerTag.project.title}</strong>
                </p>
              )}

              {triggerTag?.quote && (
                <blockquote className="border-l-3 border-[var(--accent)] pl-4 text-folio-body text-folio-text-secondary italic mb-4">
                  &ldquo;{triggerTag.quote}&rdquo;
                  {designer && (
                    <span className="block text-folio-meta text-folio-text-tertiary mt-1 not-italic">
                      — {designer.name}{designer.companyName ? `, ${designer.companyName}` : ''}
                    </span>
                  )}
                </blockquote>
              )}

              {designer && (
                <p className="text-folio-meta text-folio-text-tertiary">
                  {designer.followerCount.toLocaleString()} followers on Folio
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* Section 2: What Just Happened */}
      <ScrollSection
        id="what-happened"
        trackRef={sectionRef('what-happened')}
        animation="fade-up"
      >
        <div className="text-center mb-12">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-folio-text-primary mb-4">
            What just happened
          </h2>
          <p className="text-folio-body text-folio-text-secondary max-w-2xl mx-auto">
            A designer used your product in their project and tagged it on Folio.
            This creates automatic attribution — visible to their followers and your entire industry.
          </p>
        </div>

        {/* Animated flow */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-12">
          {[
            { label: 'Designer tags product', icon: '1' },
            { label: 'Folio captures attribution', icon: '2' },
            { label: 'Your brand gets credited', icon: '3' },
          ].map((step, i) => (
            <motion.div
              key={step.label}
              className="flex items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
            >
              <div className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-white flex items-center justify-center font-semibold text-sm">
                {step.icon}
              </div>
              <span className="text-folio-body text-folio-text-primary font-medium">
                {step.label}
              </span>
              {i < 2 && (
                <span className="hidden md:block text-folio-text-tertiary text-2xl ml-4">
                  &rarr;
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Live stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-surface-elevated rounded-neu-lg p-8">
            <LiveMetric value={stats.productsTagged} label="Products Tagged" />
            <LiveMetric value={stats.uniqueDesigners} label="Unique Designers" />
            <LiveMetric value={stats.projectsFeaturedIn} label="Projects Featured In" />
          </div>
        )}
      </ScrollSection>

      {/* Section 3: What You Can Do */}
      <ScrollSection
        id="what-you-can-do"
        trackRef={sectionRef('what-you-can-do')}
        animation="fade-up"
        bg="elevated"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-folio-text-primary text-center mb-12">
          What you can do
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'See Your Tags',
              description: 'View every project where designers have used your products. Real attribution, automatically captured.',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ),
            },
            {
              title: 'Connect with Designers',
              description: 'Reach out to the designers who are already specifying your products. Build direct relationships.',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
            {
              title: 'Invite Your Team',
              description: 'Bring your admin on board to unlock full analytics, designer details, and the founding vendor program.',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              className="bg-surface-canvas rounded-neu p-6 shadow-neu-raised"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              <div className="w-12 h-12 rounded-neu-sm bg-surface-elevated flex items-center justify-center text-[var(--accent)] mb-4">
                {card.icon}
              </div>
              <h3 className="text-folio-ui text-folio-text-primary font-semibold mb-2">
                {card.title}
              </h3>
              <p className="text-folio-meta text-folio-text-secondary">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
      </ScrollSection>

      {/* Section 4: You Can Earn */}
      <ScrollSection
        id="earn"
        trackRef={sectionRef('earn')}
        animation="fade-up"
      >
        <div className="text-center mb-10">
          <h2 className="font-[var(--font-headline)] text-folio-h2 text-folio-text-primary mb-4">
            Earn Folio Credits
          </h2>
          <p className="text-folio-body text-folio-text-secondary max-w-2xl mx-auto">
            When designers tag your products, they earn credits. When you engage and
            activate your vendor page, you earn them too. Credits unlock premium
            features across the Folio platform.
          </p>
        </div>

        {/* Invite admin CTA */}
        <div className="bg-surface-elevated rounded-neu-lg p-8 max-w-lg mx-auto">
          <h3 className="text-folio-ui text-folio-text-primary font-semibold mb-2">
            Invite your admin to unlock everything
          </h3>
          <p className="text-folio-meta text-folio-text-secondary mb-4">
            Full designer details, analytics, and the founding vendor program
            require admin activation.
          </p>

          {inviteSent ? (
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-folio-body font-medium">Invitation sent!</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="flex-1 px-4 py-2.5 border border-folio-border-subtle rounded-neu-btn text-folio-body bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={handleInviteAdmin}
                disabled={inviting || !inviteEmail}
                className="px-5 py-2.5 bg-[var(--text-primary)] text-white rounded-neu-btn font-medium text-folio-ui hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Invite'}
              </button>
            </div>
          )}
        </div>
      </ScrollSection>

      {/* Section 5: What Happens Next */}
      <ScrollSection
        id="next-steps"
        trackRef={sectionRef('next-steps')}
        animation="fade-up"
        bg="warm"
      >
        <h2 className="font-[var(--font-headline)] text-folio-h2 text-folio-text-primary text-center mb-12">
          What happens next
        </h2>

        <div className="max-w-lg mx-auto space-y-6">
          {[
            {
              step: 1,
              title: 'You claimed your page',
              description: `You're here — ${organizationName} is now on Folio.`,
              done: true,
            },
            {
              step: 2,
              title: 'Invite your admin',
              description: 'An admin or decision-maker activates the account to unlock full features.',
              done: inviteSent,
            },
            {
              step: 3,
              title: 'Admin reviews the pitch',
              description: 'They\'ll see the full designer data, analytics, and partnership options.',
              done: false,
            },
            {
              step: 4,
              title: 'Unlock full analytics',
              description: 'See designer identities, project details, and your full influence map.',
              done: false,
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              className="flex gap-4 items-start"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-folio-border-subtle text-folio-text-tertiary'
                }`}
              >
                {item.done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium">{item.step}</span>
                )}
              </div>
              <div>
                <h3 className="text-folio-ui font-medium text-folio-text-primary">
                  {item.title}
                </h3>
                <p className="text-folio-meta text-folio-text-secondary">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollSection>
    </div>
  );
}
