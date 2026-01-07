'use client';

import { TopDesigner } from "@/lib/mock/eventAnalytics";
import { formatCurrency, formatCompactNumber } from "@/lib/format";
import { FocusContext } from "@/lib/suggestions/types";
import VisualActionCard from "@/components/analytics/VisualActionCard";
import ActionPill from "@/components/analytics/ui/ActionPill";
import { toast } from 'sonner';

interface TopDesignersTableProps {
  designers: TopDesigner[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function TopDesignersTable({ designers, onHover }: TopDesignersTableProps) {
  const grantSamples = (designerId: string) => {
    toast.success(`Sample credits granted to ${designers.find(d => d.id === designerId)?.name}`);
  };

  const startEditorial = (designerId: string) => {
    toast.success(`Editorial partnership started with ${designers.find(d => d.id === designerId)?.name}`);
  };

  return (
    <VisualActionCard
      title="Top Designers"
      tone="engage"
      visual={
        <ul className="divide-y divide-white/6">
          {designers.slice(0,6).map((designer, index) => (
            <li key={designer.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#8C8278] rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {designer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <span className="font-medium text-canvas">{designer.name}</span>
                  <div className="text-xs text-stone-700">
                    {formatCompactNumber(designer.saves)} saves • {formatCurrency(designer.estProjectValueUsd, 'USD', true)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <ActionPill label="Sample credits" onClick={()=>grantSamples(designer.id)} />
                <ActionPill label="Co-author editorial" onClick={()=>startEditorial(designer.id)} />
              </div>
            </li>
          ))}
        </ul>
      }
      what="Designers driving the most saves and project value"
      why="Focus outreach on high-value designers for partnerships"
      actions={[
        { label:'Export designer list', onClick:()=>toast.success('Designer list exported') },
        { label:'Create outreach campaign', onClick:()=>toast.success('Outreach campaign created') },
      ]}
    />
  );
}
