"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, TrendingUp, Target } from "lucide-react";

export function TopFirmsPills({ firms }: {
  firms: Array<{ 
    id: string; 
    name: string; 
    valueUsd: number; 
    bestDow: string; 
    bestHour: number;
  }>
}) {
  return (
    <Card className="p-4 bg-surface-canvas border-folio-border-strong">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-folio-text-primary mb-1">Key Account Actions</h3>
          <p className="text-xs text-folio-text-secondary">High-value firms ready for next touchpoint</p>
        </div>
        <Badge className="bg-surface-elevated text-folio-text-primary border-folio-border-strong">
          <Target className="w-3 h-3 mr-1" />
          {firms.length} accounts
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {firms.slice(0, 3).map(f => (
          <div key={f.id} className="group border border-folio-border-strong bg-surface-elevated/50 rounded-lg p-3 hover:bg-surface-canvas hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-folio-text-primary truncate">{f.name}</div>
              <Badge className="bg-[#8C8278] text-white text-xs px-2 py-0.5">
                ${(f.valueUsd/1000).toFixed(0)}k potential
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-folio-text-secondary">
                <Clock className="w-3 h-3" />
                <span>Best: {f.bestDow} {String(f.bestHour).padStart(2,'0')}:00</span>
              </div>
              <Button 
                size="sm" 
                className="h-7 px-3 text-xs bg-folio-text-primary hover:bg-[#8C8278] text-white"
              >
                Contact
              </Button>
            </div>
            
            <div className="mt-2 text-xs text-folio-text-secondary">
              {f.valueUsd > 2500000 ? "🔥 High-value account" : f.valueUsd > 1500000 ? "⚡ Strong potential" : "💼 Growing opportunity"}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
