'use client';

import { useState } from 'react';
import { useAIUnlocked } from './useAIAccess';
import { useDemoState } from '@/lib/vendor-data/demoState';
import { computeAIBundle, type AIBundle } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { AIAnalystDrawer } from './AIAnalystDrawer';
import { AIUpsellModal } from './AIUpsellModal';

export type AIPaneProps = {
  sectionId: 'events' | 'projects' | 'designerFunnel' | 'revenue';
  title?: string;
};

type TabId = 'explain' | 'compare' | 'recommend' | 'act';

type AISectionContent = {
  explain: React.ReactNode;
  compare: React.ReactNode;
  recommend: React.ReactNode;
  act: React.ReactNode;
  rawContext: any;
};

export function AIPane({ sectionId, title }: AIPaneProps) {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const [activeTab, setActiveTab] = useState<TabId>('explain');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const bundle = computeAIBundle(state);
  const content = buildAIContent(sectionId, bundle);

  function onTabClick(tab: TabId) {
    if (!aiUnlocked) {
      setUpsellOpen(true);
      return;
    }
    setActiveTab(tab);
  }

  function onWhyClick() {
    if (!aiUnlocked) {
      setUpsellOpen(true);
      return;
    }
    setDrawerOpen(true);
  }

  return (
    <>
      <section className="mt-4 ridge-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="folio-meta font-semibold uppercase tracking-wide text-folio-text-secondary">
              AI Insights
            </span>
            <AIBadge />
          </div>
          <div className="flex items-center gap-1">
            {(['explain', 'compare', 'recommend', 'act'] as TabId[]).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabClick(tab)}
                className={`px-2.5 py-1 rounded-full capitalize text-[var(--type-eyebrow)] transition ${
                  activeTab === tab && aiUnlocked
                    ? 'bg-[var(--text-primary)] text-[var(--surface-canvas)]'
                    : 'bg-surface-ground text-folio-text-primary hover:bg-[var(--ridge-inner)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {!aiUnlocked ? (
          <div className="folio-meta text-folio-text-secondary flex items-center justify-between py-2">
            <span>
              With Folio AI, you'll see what this data means, how you compare, and the best actions
              to take - all in one click.
            </span>
            <button
              type="button"
              className="ml-3 rounded-xl px-3 py-1.5 bg-[var(--text-primary)] text-[var(--surface-canvas)] text-[var(--type-eyebrow)] hover:opacity-90 transition whitespace-nowrap"
              onClick={() => setUpsellOpen(true)}
            >
              Unlock AI
            </button>
          </div>
        ) : (
          <>
            <div className="folio-meta leading-relaxed text-folio-text-primary min-h-[40px] py-1">
              {activeTab === 'explain' && content.explain}
              {activeTab === 'compare' && content.compare}
              {activeTab === 'recommend' && content.recommend}
              {activeTab === 'act' && content.act}
            </div>
            <div className="flex items-center justify-between text-[var(--type-eyebrow)] text-folio-text-secondary pt-2 border-t border-folio-border-subtle">
              <button
                type="button"
                onClick={onWhyClick}
                className="underline underline-offset-4 hover:text-folio-text-primary transition"
              >
                Why this?
              </button>
              <span>
                Powered by designer behavior, event performance, and SKU usage across Folio.
              </span>
            </div>
          </>
        )}
      </section>

      {upsellOpen && <AIUpsellModal onClose={() => setUpsellOpen(false)} />}
      <AIAnalystDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sectionId={sectionId}
        context={content.rawContext}
      />
    </>
  );
}

function buildAIContent(sectionId: AIPaneProps['sectionId'], bundle: AIBundle): AISectionContent {
  switch (sectionId) {
    case 'events': {
      const topEvent = bundle.opportunityMap.find(n => n.type === 'event');
      const rev = bundle.revenueProjection;
      return {
        explain: (
          <>
            Your current event portfolio is driving approximately{' '}
            <strong className="text-folio-text-primary">${Math.round(rev.projectedInfluenceUsd / 1_000_000)}M</strong> in influenced
            project value next quarter.{' '}
            {topEvent ? (
              <>Most of this is concentrated around <strong className="text-folio-text-primary">{topEvent.label}</strong>.</>
            ) : null}
          </>
        ),
        compare: (
          <>
            Based on similar vendors, your event performance appears{' '}
            <strong className="text-folio-text-primary">above average</strong>, with stronger conversion from RSVP → tagged project than
            many peers.
          </>
        ),
        recommend: (
          <>
            Focus on your top event, reinforce SKUs that designers are already saving, and consider
            testing increased presence or programming at that event for +10–15% upside.
          </>
        ),
        act: (
          <>
            Use the actions in this section to shift more budget to high-performing events,
            highlight your top SKUs in upcoming shows, or plan a targeted activation.
          </>
        ),
        rawContext: { section: 'events', bundle },
      };
    }
    case 'projects': {
      const kpi = bundle.qbr.totals;
      return {
        explain: (
          <>
            Projects tagged with your products currently represent about{' '}
            <strong className="text-folio-text-primary">${Math.round(kpi.influenceUsd / 1_000_000)}M</strong> in influenced value, driven
            by saves and tags across active designer portfolios.
          </>
        ),
        compare: (
          <>
            Your saves and tags put you in the <strong className="text-folio-text-primary">top cohort</strong> of vendors on Folio, with
            room to grow via deeper collaboration with your highest-affinity studios.
          </>
        ),
        recommend: (
          <>
            Double down on the designers who already use your products, and expand similar SKUs
            where they've shown strong adoption.
          </>
        ),
        act: (
          <>
            From here, you might invite top designers to a private preview, sponsor an editorial on
            their work, or launch a curated bundle featuring your most-used SKUs.
          </>
        ),
        rawContext: { section: 'projects', bundle },
      };
    }
    case 'designerFunnel': {
      const f = bundle.designerFunnel;
      return {
        explain: (
          <>
            You currently have <strong className="text-folio-text-primary">{f.total.toLocaleString()}</strong> designers in your orbit. A meaningful portion
            are warming or high intent, which is where most of your future revenue will come from.
          </>
        ),
        compare: (
          <>
            Relative to your total designer base, your high-intent segment is{' '}
            <strong className="text-folio-text-primary">{f.highIntent.toLocaleString()}</strong> designers. Growing this group even slightly can have an
            outsized impact on your influenced value.
          </>
        ),
        recommend: (
          <>
            Identify designers on the edge of high intent and offer them targeted support: samples,
            technical guidance, or co-marketing opportunities.
          </>
        ),
        act: (
          <>
            Use Folio to invite high-intent designers to a lunch & learn, send curated sample
            kits, or highlight case studies of their work using your products.
          </>
        ),
        rawContext: { section: 'designerFunnel', bundle },
      };
    }
    case 'revenue':
    default: {
      const rev = bundle.revenueProjection;
      return {
        explain: (
          <>
            Based on current activity, your next quarter is projected at{' '}
            <strong className="text-folio-text-primary">${Math.round(rev.projectedInfluenceUsd / 1_000_000)}M</strong> in influenced
            value, a change of <strong className="text-folio-text-primary">{rev.changePct > 0 ? '+' : ''}{rev.changePct}%</strong> vs prior period.
          </>
        ),
        compare: (
          <>
            Vendors with similar profiles typically fall in the ±10% band around this projection. Your
            current trajectory places you <strong className="text-folio-text-primary">slightly ahead</strong> of that curve.
          </>
        ),
        recommend: (
          <>
            Lean into the drivers identified below and watch for early signals that project pipelines
            are either accelerating or stalling so you can adjust quickly.
          </>
        ),
        act: (
          <>
            From here you might sponsor an editorial around your strongest category, reallocate a
            portion of event spend to the highest ROI venues, or launch a focused sampling push.
          </>
        ),
        rawContext: { section: 'revenue', bundle },
      };
    }
  }
}


