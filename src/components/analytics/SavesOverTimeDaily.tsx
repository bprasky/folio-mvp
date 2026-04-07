"use client";

import { ResponsiveContainer, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { Badge } from "@/components/ui/badge";
import VisualActionCard from './VisualActionCard';
import KpiDial from './ui/KpiDial';
import { toast } from 'sonner';

interface SavesOverTimeDailyProps {
  eventDates: { start: string; end: string };
  totalSaves: number;
  totalTags: number;
}

export function SavesOverTimeDaily({ eventDates, totalSaves, totalTags }: SavesOverTimeDailyProps) {
  // Generate daily data (mock - in real app, this would come from actual daily tracking)
  const generateDailyData = () => {
    const start = new Date(eventDates.start);
    const end = new Date(eventDates.end);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const dailyData = [];
    let cumSaves = 0;
    let cumTags = 0;
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      
      // Simulate daily pattern with spikes
      const baseDaily = totalSaves / days;
      const spike = i === 1 ? 2.5 : i === Math.floor(days / 2) ? 1.8 : 1.0; // Session/booth spikes
      const dailySaves = Math.floor(baseDaily * spike);
      const dailyTags = Math.floor((dailySaves * totalTags) / totalSaves * 0.8);
      
      cumSaves += dailySaves;
      cumTags += dailyTags;
      
      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        saves_day: dailySaves,
        tags_day: dailyTags,
        saves_cum: cumSaves,
        tags_cum: cumTags,
        annotation: i === 1 ? 'Opening session spike' : i === Math.floor(days / 2) ? 'Booth QR campaign' : null
      });
    }
    
    return dailyData;
  };

  const dailyData = generateDailyData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface-canvas border border-[var(--grid)] rounded-lg p-3 shadow-lg">
          <div className="font-medium text-[var(--ink)] mb-2">{label}</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--slate)]">Saves (day):</span>
              <span className="h-num font-semibold text-[var(--teal)]">{data.saves_day}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[var(--slate)]">Tags (day):</span>
              <span className="h-num font-semibold text-[var(--emerald)]">{data.tags_day}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--grid)]">
              <span className="text-[var(--slate)]">Cumulative saves:</span>
              <span className="h-num font-semibold text-[var(--ink)]">{data.saves_cum}</span>
            </div>
            {data.annotation && (
              <div className="pt-2 mt-2 border-t border-[var(--grid)] text-[var(--amber)] font-medium">
                {data.annotation}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const conversionRate = totalSaves > 0 ? Math.round((totalTags / totalSaves) * 100) : 0;
  
  return (
    <VisualActionCard
      title="Saves Over Time"
      tone="perf"
      visual={
        <div className="flex items-center gap-6">
          <KpiDial value={totalSaves.toLocaleString()} label="Total Saves" tone="perf"/>
          <KpiDial value={`${conversionRate}%`} label="Save→Tag" delta={12} tone="perf"/>
          <div style={{ width: '200px', height: '120px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData.slice(-7)}>
                <Line type="monotone" dataKey="saves_day" stroke="var(--teal)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      }
      what="Daily engagement patterns with spikes"
      why="Timing reveals optimal send windows"
      actions={[
        { label:'Pin hero SKUs 14d', onClick:()=>toast.success('Hero SKUs pinned for 14 days') },
        { label:'Export timeline', onClick:()=>toast.success('Timeline exported') },
      ]}
    />
  );
}


