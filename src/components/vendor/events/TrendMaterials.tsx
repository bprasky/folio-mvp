'use client';

import { TrendMaterial } from "@/lib/mock/eventAnalytics";
import { formatDelta } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";
import { FocusContext } from "@/lib/suggestions/types";
import VisualActionCard from "@/components/analytics/VisualActionCard";
import ActionPill from "@/components/analytics/ui/ActionPill";
import { toast } from 'sonner';

interface TrendMaterialsProps {
  materials: TrendMaterial[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function TrendMaterials({ materials, onHover }: TrendMaterialsProps) {
  const featureMaterial = (materialName: string) => {
    toast.success(`${materialName} featured in lookbook`);
  };

  const createBundle = (materialName: string) => {
    toast.success(`Bundle created with ${materialName}`);
  };

  // Show skeleton loading if no materials data
  if (!materials || materials.length === 0) {
    return (
      <VisualActionCard
        title="Trending Materials"
        tone="opp"
        visual={
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 bg-canvas/10 rounded-lg animate-pulse"
              >
                <div className="flex-1">
                  <div className="h-4 bg-stone-300 rounded w-3/4"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-stone-300 rounded"></div>
                  <div className="h-5 bg-stone-300 rounded w-12"></div>
                </div>
              </div>
            ))}
            <div className="text-center py-4 text-sm text-stone-700">
              Loading trending materials...
            </div>
          </div>
        }
        what="Materials gaining traction with designers"
        why="Trending materials indicate market demand shifts"
        actions={[
          { label:'Refresh trends', onClick:()=>toast.success('Trends refreshed') },
          { label:'Create material bundle', onClick:()=>toast.success('Material bundle created') },
        ]}
      />
    );
  }

  return (
    <VisualActionCard
      title="Trending Materials"
      tone="opp"
      visual={
        <div className="grid grid-cols-2 gap-3">
          {materials.slice(0, 6).map((material, index) => {
            const delta = formatDelta(material.deltaPct);
            const isPositive = delta.isPositive;
            
            return (
              <div 
                key={material.name} 
                className="p-3 bg-canvas/10 rounded-lg hover:bg-canvas/20 transition-colors cursor-pointer group"
                data-testid={`material-${index}`}
                onMouseEnter={() => onHover?.({
                  type: 'product',
                  key: material.name,
                  data: material
                })}
                onMouseLeave={() => onHover?.(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-canvas text-sm truncate">{material.name}</span>
                  <div className="flex items-center space-x-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-accent-opp" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-accent-risk" />
                    )}
                    <span className={`text-xs font-medium ${
                      isPositive ? 'text-accent-opp' : 'text-accent-risk'
                    }`}>
                      {delta.text}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ActionPill label="Feature" onClick={()=>featureMaterial(material.name)} />
                  <ActionPill label="Bundle" onClick={()=>createBundle(material.name)} />
                </div>
              </div>
            );
          })}
        </div>
      }
      what="Materials gaining traction with designers"
      why="Trending materials indicate market demand shifts"
      actions={[
        { label:'Create material bundle', onClick:()=>toast.success('Material bundle created') },
        { label:'Export trends', onClick:()=>toast.success('Trends exported') },
      ]}
    />
  );
}