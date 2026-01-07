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
    <Card className="p-4 bg-white border-[#DAD2CA]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#2B2B2B] mb-1">Key Account Actions</h3>
          <p className="text-xs text-[#8C8278]">High-value firms ready for next touchpoint</p>
        </div>
        <Badge className="bg-[#F7F4F1] text-[#2B2B2B] border-[#DAD2CA]">
          <Target className="w-3 h-3 mr-1" />
          {firms.length} accounts
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {firms.slice(0, 3).map(f => (
          <div key={f.id} className="group border border-[#DAD2CA] bg-[#F7F4F1]/50 rounded-lg p-3 hover:bg-white hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-[#2B2B2B] truncate">{f.name}</div>
              <Badge className="bg-[#8C8278] text-white text-xs px-2 py-0.5">
                ${(f.valueUsd/1000).toFixed(0)}k potential
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-[#8C8278]">
                <Clock className="w-3 h-3" />
                <span>Best: {f.bestDow} {String(f.bestHour).padStart(2,'0')}:00</span>
              </div>
              <Button 
                size="sm" 
                className="h-7 px-3 text-xs bg-[#2B2B2B] hover:bg-[#8C8278] text-white"
              >
                Contact
              </Button>
            </div>
            
            <div className="mt-2 text-xs text-[#645C53]">
              {f.valueUsd > 2500000 ? "🔥 High-value account" : f.valueUsd > 1500000 ? "⚡ Strong potential" : "💼 Growing opportunity"}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
