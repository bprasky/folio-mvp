"use client";

import VisualActionCard from './VisualActionCard';
import KpiDial from './ui/KpiDial';
import { toast } from 'sonner';

interface TimeToSpecFlatProps {
  data: any;
}

export default function TimeToSpecFlat({ data }: TimeToSpecFlatProps) {
  const median = data?.medianHours ?? 18;
  const p90 = data?.p90Hours ?? 72;
  
  return (
    <VisualActionCard
      title="Time to Spec"
      tone="perf"
      visual={
        <div className="flex items-center gap-8">
          <KpiDial value={`${median}h`} label="Median" delta={data?.medianDelta} tone="perf"/>
          <KpiDial value={`${p90}h`} label="P90" delta={data?.p90Delta} tone="risk"/>
        </div>
      }
      what="Best window: Tue 14:00 / Thu 10:00"
      why="Faster responses within 24–48h drive 2.1× spec-rate"
      actions={[
        { label:'Schedule follow-ups', onClick:()=>toast.success('Follow-ups scheduled') },
        { label:'Enable mobile CAD', onClick:()=>toast.success('Mobile CAD toggled') },
      ]}
    />
  );
}



