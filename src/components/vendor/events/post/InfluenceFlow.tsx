'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowRight, AlertTriangle } from "lucide-react";
import type { SankeyNode, SankeyLink } from "@/lib/mock/eventPost";

interface InfluenceFlowProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  onHover?: (nodeId: string | null, linkIndex?: number) => void;
  variant?: 'sankey' | 'bars';
}

export function InfluenceFlow({ nodes, links, onHover, variant = 'bars' }: InfluenceFlowProps) {
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  const handleLinkHover = useCallback((linkIndex: number | null) => {
    setHoveredLink(linkIndex);
    const link = linkIndex !== null ? links[linkIndex] : null;
    onHover?.(link?.target || null, linkIndex || undefined);
  }, [links, onHover]);

  const getLinkWidth = (value: number, maxValue: number) => {
    return Math.max(value / maxValue * 100, 8);
  };

  const getConversionRate = (link: SankeyLink) => {
    const sourceNode = nodes.find(n => n.id === link.source);
    return sourceNode ? Math.round((link.value / sourceNode.value) * 100) : 0;
  };

  const maxValue = Math.max(...links.map(l => l.value));

  if (variant === 'bars') {
    return (
      <Card className="bg-white border-[#DAD2CA]">
        <CardHeader>
          <CardTitle className="text-lg font-serif text-[#2B2B2B] flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#8C8278]" />
            <span>Influence Flow</span>
          </CardTitle>
          <p className="text-sm text-[#8C8278]">
            Where attention became intent — and where it leaked
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {links.map((link, index) => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            const conversionRate = getConversionRate(link);
            const isHovered = hoveredLink === index;
            
            if (!sourceNode || !targetNode) return null;

            return (
              <div 
                key={`${link.source}-${link.target}`}
                className="relative"
                onMouseEnter={() => handleLinkHover(index)}
                onMouseLeave={() => handleLinkHover(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm font-medium text-[#2B2B2B]">
                      {sourceNode.label}
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#8C8278]" />
                    <div className="text-sm font-medium text-[#2B2B2B]">
                      {targetNode.label}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {conversionRate}%
                    </Badge>
                  </div>
                  
                  {link.leakNote && (
                    <div className="flex items-center space-x-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{link.leakNote}</span>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="w-full bg-[#F7F4F1] rounded-full h-6">
                    <div 
                      className={`h-6 rounded-full transition-all duration-300 ${
                        isHovered ? 'bg-[#8C8278]' : 'bg-[#3A332E]'
                      }`}
                      style={{ width: `${getLinkWidth(link.value, maxValue)}%` }}
                    />
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {link.value.toLocaleString()}
                    </span>
                  </div>
                </div>

                {link.expectedLiftPct && (
                  <div className="mt-1 text-xs text-green-600">
                    +{link.expectedLiftPct}% lift with {link.fix === 'specs' ? 'spec sheets' : 
                     link.fix === 'renders' ? 'renders' : 
                     link.fix === 'samples' ? 'samples' : 
                     link.fix === 'promo' ? 'close offer' : 'action'}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // Fallback for when Sankey chart is not available
  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#2B2B2B]">
          Influence Flow
        </CardTitle>
        <p className="text-sm text-[#8C8278]">
          Where attention became intent — and where it leaked
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="text-center py-8 text-[#8C8278]">
          Flow visualization loading...
        </div>
      </CardContent>
    </Card>
  );
}









