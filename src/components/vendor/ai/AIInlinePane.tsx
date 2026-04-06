'use client';

import { useState } from 'react';
import { useAIUnlocked } from './useAIAccess';
import { useDemoState } from '@/lib/vendor-data/demoState';
import { computeAIBundle, type AIBundle } from '@/lib/vendor-data/ai/engine';
import { AIBadge } from '../shared/AIBadge';
import { AIAnalystDrawer } from './AIAnalystDrawer';
import { AIUpsellModal } from './AIUpsellModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type SectionId = 'events' | 'projects' | 'designerFunnel' | 'revenue';

type TabId = 'explain' | 'compare' | 'recommend' | 'act';

type Props = {
  sectionId: SectionId;
  className?: string;
};

type InlineContent = {
  summary: Record<TabId, string>;
  details: Record<TabId, string>;
  rawContext: any;
};

export function AIInlinePane({ sectionId, className }: Props) {
  const aiUnlocked = useAIUnlocked();
  const { state } = useDemoState();
  const [activeTab, setActiveTab] = useState<TabId>('explain');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState<string | null>(null);

  const bundle = computeAIBundle(state);
  const content = buildInlineContent(sectionId, bundle);

  const handleTabClick = (tab: TabId) => {
    if (!aiUnlocked) {
      setUpsellOpen(true);
      return;
    }
    setActiveTab(tab);
    setPopoverOpen(tab);
  };

  const handleWhyClick = () => {
    if (!aiUnlocked) {
      setUpsellOpen(true);
      return;
    }
    setDrawerOpen(true);
  };

  const tabs: TabId[] = ['explain', 'compare', 'recommend', 'act'];

  return (
    <>
      <div
        className={
          'mt-2 -mx-4 md:-mx-6 flex flex-col gap-1 rounded-b-2xl border-t border-folio-border-subtle bg-surface-canvas/70 backdrop-blur-md px-4 md:px-6 py-2 folio-meta ' +
          (className ?? '')
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AIBadge />
            <span className="uppercase tracking-wide text-[10px] text-folio-text-secondary">
              AI for this section
            </span>
          </div>

          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <Popover key={tab} open={popoverOpen === tab} onOpenChange={(open) => setPopoverOpen(open ? tab : null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleTabClick(tab)}
                    className={
                      'px-2.5 py-1 rounded-full capitalize text-[10px] transition ' +
                      (activeTab === tab && aiUnlocked
                        ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                        : 'bg-surface-ground text-folio-text-primary hover:bg-[var(--ridge-inner)]')
                    }
                  >
                    {tab}
                  </button>
                </PopoverTrigger>
                {aiUnlocked && (
                  <PopoverContent className="text-[11px] leading-relaxed">
                    <div className="font-semibold mb-2 capitalize text-folio-text-primary">{tab}</div>
                    <p className="text-folio-text-primary">{content.details[tab]}</p>
                  </PopoverContent>
                )}
              </Popover>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] leading-snug text-folio-text-primary flex-1 line-clamp-2">
            {aiUnlocked
              ? content.summary[activeTab]
              : 'Unlock Folio AI to interpret this metric, compare you to peers, and recommend the next steps.'}
          </div>
          <button
            type="button"
            onClick={handleWhyClick}
            className="shrink-0 text-[11px] underline underline-offset-4 text-folio-text-secondary hover:text-folio-text-primary transition opacity-70 hover:opacity-100"
          >
            Why this?
          </button>
        </div>
      </div>

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

function buildInlineContent(sectionId: SectionId, bundle: AIBundle): InlineContent {
  const base: InlineContent = {
    summary: {
      explain: '',
      compare: '',
      recommend: '',
      act: '',
    },
    details: {
      explain: '',
      compare: '',
      recommend: '',
      act: '',
    },
    rawContext: { sectionId, bundle },
  };

  switch (sectionId) {
    case 'events': {
      const topEvent = bundle.opportunityMap.find((n) => n.type === 'event');
      const rev = bundle.revenueProjection;
      const projM = Math.round((rev.projectedInfluenceUsd ?? 0) / 1_000_000);

      base.summary.explain = `Events are on track to influence ~$${projM}M in project value next quarter, with most of the lift coming from ${
        topEvent?.label ?? 'your top event'
      }.`;
      base.summary.compare = `Your event → project conversion is trending above similar vendors, especially at ${
        topEvent?.label ?? 'your leading event'
      }.`;
      base.summary.recommend =
        "Lean into the event that's already overperforming on saves and tags; modest budget shifts can yield outsized returns.";
      base.summary.act =
        'Use Folio to shift budget, highlight top SKUs at that event, or add programming like talks or demos.';

      base.details.explain =
        'This view looks at RSVPs, saves, tagged projects, and editorial mentions across all events to estimate how much influenced project value you are likely to generate in the upcoming period.';
      base.details.compare =
        'We benchmark your conversion and velocity against vendors with similar product mix and event footprint, showing whether your current events strategy is lagging, on par, or leading.';
      base.details.recommend =
        'Because one or two events are carrying the majority of your results, increasing presence, programming, or SKU focus at those events is usually more efficient than spreading budget thinly.';
      base.details.act =
        'Practical actions might include upgrading your presence at the top event, aligning samples and hero SKUs to what designers already save, or partnering with key designers for talks or live project walk-throughs.';

      return base;
    }
    case 'projects': {
      const q = bundle.qbr.totals;
      const influenceM = Math.round((q.influenceUsd ?? 0) / 1_000_000);

      base.summary.explain = `Projects using your products currently represent about $${influenceM}M in influenced value across active designer work.`;
      base.summary.compare =
        'You are tracking in the upper band for project influence relative to similar vendors, with room to grow through deeper collaboration with your top studios.';
      base.summary.recommend =
        'Focus on designers who already tag your SKUs often, and expand similar SKUs where they have shown strong adoption.';
      base.summary.act =
        'Use Folio to invite top designers to a preview, sponsor an editorial on their projects, or launch a curated bundle based on their favorite SKUs.';

      base.details.explain =
        'The project influence view looks at where your SKUs are actually tagged inside real projects, translating saves and tags into an approximate pipeline of specification value.';
      base.details.compare =
        'When we compare your saves, tags, and influence per designer to similar vendors, we can highlight whether your current project footprint is under-utilized or already strong.';
      base.details.recommend =
        'Because it is easier to expand existing usage than to start from zero, doubling down on your most active designers and SKUs typically delivers the best return.';
      base.details.act =
        'Actions can include targeted outreach to top designers, co-marketing around completed projects, and introducing adjacent SKUs where designers are already active.';

      return base;
    }
    case 'designerFunnel': {
      const f = bundle.designerFunnel;

      base.summary.explain = `You have ${f.total.toLocaleString()} designers in your orbit, with ${f.highIntent.toLocaleString()} showing high intent based on recent saves, tags, and event engagement.`;
      base.summary.compare =
        'Relative to your total designer base, your high-intent segment is healthy but could be expanded for outsized gains.';
      base.summary.recommend =
        'Give high-intent designers fast support and exclusive access; they are closest to making specification decisions.';
      base.summary.act =
        'Use Folio to invite these designers to a lunch & learn, send curated samples, or highlight their work using your materials.';

      base.details.explain =
        'The designer funnel segments your audience into exploring, warming, high intent, and closed, based on how they interact with your catalog and events.';
      base.details.compare =
        'By comparing the shape of your funnel to similar vendors, we can tell if you are over-weighted at the top, thin in the middle, or under-leveraging high-intent designers.';
      base.details.recommend =
        'In most cases, targeted support for the designers closest to specification yields better results than broad top-of-funnel activity.';
      base.details.act =
        'You can turn these insights into action by scheduling focused sessions, sending sample kits, or setting up co-marketing around their projects.';

      return base;
    }
    case 'revenue':
    default: {
      const rev = bundle.revenueProjection;
      const projM = Math.round((rev.projectedInfluenceUsd ?? 0) / 1_000_000);

      base.summary.explain = `Next period is projected around $${projM}M in influenced value, a ${rev.changePct > 0 ? '+' : ''}${rev.changePct}% change over the prior period.`;
      base.summary.compare =
        'Your trajectory places you slightly ahead of similar vendors, assuming current behavior continues.';
      base.summary.recommend =
        'Lean into the events, designers, and SKUs contributing the most momentum while watching for early signs of slowdown.';
      base.summary.act =
        'From here, you might rebalance event spend, create campaigns around your strongest category, or reinforce support for your top designers.';

      base.details.explain =
        'The projection uses event performance, designer activity, and SKU usage trends to estimate where your influenced value is heading.';
      base.details.compare =
        'We compare your projected path to historical patterns and to similar vendors so you can see whether you are drifting above, below, or in line with expectations.';
      base.details.recommend =
        'Rather than reacting after the fact, you can make small adjustments earlier in the quarter to stay on or ahead of your desired trajectory.';
      base.details.act =
        'Examples include shifting focus to faster-growing categories, aligning event presence with the most responsive markets, or tuning your sampling strategy.';

      return base;
    }
  }
}

