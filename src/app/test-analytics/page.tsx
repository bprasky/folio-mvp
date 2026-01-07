import { ErrorBoundary } from '@/components/analytics/ErrorBoundary';
import { ChartCard } from '@/components/analytics/ChartCard';
import { KpiRing } from '@/components/analytics/KpiRing';
import { AiBreakdown } from '@/components/analytics/AiBreakdown';
import { PlaceholderChart } from '@/components/analytics/PlaceholderChart';
import SummaryStrip from '@/components/analytics/SummaryStrip';

export default function TestAnalytics() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-ink text-canvas">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-8">
          <h1 className="text-3xl font-serif mb-8">Analytics Dashboard Test</h1>
          
          {/* Test Summary Strip */}
          <section className="mb-6">
            <SummaryStrip items={[
              { label:'Test Pipeline', value:'$1.2M', delta:5, tone:'opp' },
              { label:'Test Designers', value:123, delta:3, tone:'engage' },
              { label:'Test Saves/Designer', value:'2.1', delta:-1, tone:'perf' },
              { label:'Test Save→Tag', value:'45%', delta:2, tone:'perf' },
            ]}/>
          </section>
          
          <div className="grid gap-6 max-w-4xl">
            <ChartCard title="Test Chart" tone="perf">
              <PlaceholderChart title="Test Chart" description="This is a test chart component"/>
            </ChartCard>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard title="KPI Test" tone="engage">
                <div className="flex items-center gap-6">
                  <KpiRing value={76} label="Test" tone="engage"/>
                  <div className="text-sm">
                    <p>Test KPI component</p>
                  </div>
                </div>
              </ChartCard>
              
              <ChartCard title="AI Breakdown Test" tone="opp">
                <AiBreakdown 
                  what="This is a test breakdown"
                  why="To verify the component works"
                  next={["Test action 1", "Test action 2", "Test action 3"]}
                />
              </ChartCard>
            </div>
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}
