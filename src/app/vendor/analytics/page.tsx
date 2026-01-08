import FlipCard from '@/components/analytics/FlipCard';
import { ChartCard } from '@/components/analytics/ChartCard';
import { KpiRing } from '@/components/analytics/KpiRing';
import { AiBreakdown } from '@/components/analytics/AiBreakdown';
import { PlaceholderChart } from '@/components/analytics/PlaceholderChart';
import { ErrorBoundary } from '@/components/analytics/ErrorBoundary';
import SummaryStrip from '@/components/analytics/SummaryStrip';
import MetricsLayout from '@/components/layout/MetricsLayout';
import MetricsCard from '@/components/metrics/MetricsCard';
import KpiNumber from '@/components/metrics/KpiNumber';
import ActionPill from '@/components/metrics/ActionPill';

// Force dynamic rendering to avoid build-time timeout
export const dynamic = 'force-dynamic';

export default function VendorAnalytics() {
  return (
    <ErrorBoundary>
      <MetricsLayout title="Folio Metrics — Vendor Analytics">
          {/* Summary Strip */}
          <section className="mb-6">
            <SummaryStrip items={[
              { label:'Pipeline', value:'$2.4M', delta:12, tone:'opp' },
              { label:'Designers', value:247, delta:8, tone:'engage' },
              { label:'Saves/Designer', value:'3.2', delta:-2, tone:'perf' },
              { label:'Save→Tag', value:'68%', delta:5, tone:'perf' },
            ]}/>
          </section>

          {/* Metrics Grid */}
          <section className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-12 auto-rows-[minmax(260px,auto)]">
            {/* Row 1 */}
            <div className="md:col-span-4">
              <MetricsCard title="Net Engagement Index" tone="engage" right={<KpiNumber value="3.832" label="Index" delta={12} tone="engage" />}>
                <div className="flex items-center gap-6">
                  <KpiRing value={76} label="QoQ" tone="engage"/>
                  <ul className="text-sm opacity-80 space-y-1">
                    <li>Sessions / Save: <b>1.98×</b></li>
                    <li>Spec-intent click-thru: <b>12.4%</b></li>
                    <li>Designer revisit rate: <b>42%</b></li>
                  </ul>
                </div>
              </MetricsCard>
            </div>

            <div className="md:col-span-3">
              <MetricsCard title="Conversion Ladder" tone="perf" right={<ActionPill label="Fix leak" onClick={()=>{}}/>}>
                <PlaceholderChart title="Funnel Flow" description="Saves → Boards → Tags → Value"/>
              </MetricsCard>
            </div>

            <div className="md:col-span-5">
              <MetricsCard title="Room × Phase Heatmap" tone="opp" right={<ActionPill label="Localize assets" onClick={()=>{}}/>}>
                <PlaceholderChart title="Heatmap" description="Room types × Project phases"/>
              </MetricsCard>
            </div>

            {/* Row 2 */}
            <div className="md:col-span-4">
              <MetricsCard title="Spec Momentum" tone="opp" right={<ActionPill label="DM top 10 designers" onClick={()=>{}}/>}>
                <PlaceholderChart title="Influence Flow" description="Designer engagement patterns"/>
              </MetricsCard>
            </div>

            <div className="md:col-span-5">
              <MetricsCard title="Saves Over Time" tone="perf" right={<ActionPill label="Pin hero SKUs (14d)" onClick={()=>{}}/>}>
                <PlaceholderChart title="Timeline" description="Daily saves and tags over time"/>
              </MetricsCard>
            </div>

            <div className="md:col-span-3">
              <MetricsCard title="Opportunity Map" tone="opp" right={<ActionPill label="VIP dinner invites" onClick={()=>{}}/>}>
                <PlaceholderChart title="2x2 Matrix" description="High-value segments"/>
              </MetricsCard>
            </div>

            {/* Row 3 */}
            <div className="md:col-span-6">
              <MetricsCard title="Time to Spec" tone="perf" right={<ActionPill label="Mobile CAD toggle" onClick={()=>{}}/>}>
                <PlaceholderChart title="Time Analysis" description="Specification latency distribution"/>
              </MetricsCard>
            </div>

            <div className="md:col-span-6">
              <MetricsCard title="Performance Benchmarks" tone="perf" right={<ActionPill label="Document tactics" onClick={()=>{}}/>}>
                <PlaceholderChart title="Benchmarks" description="Cohort comparison metrics"/>
              </MetricsCard>
            </div>
          </section>
      </MetricsLayout>
    </ErrorBoundary>
  );
}
