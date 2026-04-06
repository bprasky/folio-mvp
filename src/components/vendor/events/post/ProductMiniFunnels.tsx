'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Tag, FolderOpen, Upload, FileText, Package, Image, ArrowRight } from "lucide-react";
import type { ProductFunnel } from "@/lib/mock/eventPost";
import { formatPercentage } from "@/lib/format";

interface ProductMiniFunnelsProps {
  funnels: ProductFunnel[];
  onActionClick?: (funnel: ProductFunnel, action: string) => void;
}

export function ProductMiniFunnels({ funnels, onActionClick }: ProductMiniFunnelsProps) {
  const [sortBy, setSortBy] = useState<'saveToTagRate' | 'expectedLift'>('saveToTagRate');

  // Sort funnels based on selection
  const sortedFunnels = useMemo(() => {
    return [...funnels].sort((a, b) => {
      if (sortBy === 'saveToTagRate') {
        return b.saveToTagRatePct - a.saveToTagRatePct;
      }
      // For expectedLift, we'll use a simple calculation based on saves and tag rate
      const aExpected = (a.tags / a.saves) * a.saves * 1000; // Rough estimate
      const bExpected = (b.tags / b.saves) * b.saves * 1000;
      return bExpected - aExpected;
    });
  }, [funnels, sortBy]);

  const getAssetGapIcon = (gap: string) => {
    switch (gap) {
      case 'images': return Image;
      case 'renders': return Upload;
      case 'specs': return FileText;
      case 'samples': return Package;
      default: return Image;
    }
  };

  const getAssetGapLabel = (gap: string) => {
    switch (gap) {
      case 'images': return 'Upload images';
      case 'renders': return 'Upload renders';
      case 'specs': return 'Add spec sheets';
      case 'samples': return 'Enable sample kit';
      default: return gap;
    }
  };

  const getConversionMetric = (funnel: ProductFunnel, stage: 'saves' | 'tags' | 'projects') => {
    switch (stage) {
      case 'saves':
        return { value: funnel.saves, percentage: 100 };
      case 'tags':
        return { value: funnel.tags, percentage: (funnel.tags / funnel.saves) * 100 };
      case 'projects':
        return { value: funnel.projects, percentage: (funnel.projects / funnel.tags) * 100 };
      default:
        return { value: 0, percentage: 0 };
    }
  };

  return (
    <Card className="bg-white border-folio-border-strong">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif text-folio-text-primary flex items-center space-x-2">
              <FolderOpen className="w-5 h-5 text-folio-text-secondary" />
              <span>What worked — and what will fix it</span>
            </CardTitle>
            <p className="text-sm text-folio-text-secondary mt-1">
              Save → Tag → Project funnels with asset gap analysis
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={sortBy === 'saveToTagRate' ? 'default' : 'outline'}
              onClick={() => setSortBy('saveToTagRate')}
            >
              Save→Tag Rate
            </Button>
            <Button
              size="sm"
              variant={sortBy === 'expectedLift' ? 'default' : 'outline'}
              onClick={() => setSortBy('expectedLift')}
            >
              Expected Lift
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedFunnels.map((funnel, index) => {
            const savesMetric = getConversionMetric(funnel, 'saves');
            const tagsMetric = getConversionMetric(funnel, 'tags');
            const projectsMetric = getConversionMetric(funnel, 'projects');

            return (
              <div key={funnel.productId} className="border border-folio-border-strong rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-folio-text-primary mb-1">
                      {funnel.name}
                    </h3>
                    <div className="text-xs text-folio-text-secondary">
                      Save→Tag: {formatPercentage(funnel.saveToTagRatePct / 100)}
                    </div>
                  </div>
                  
                  {index < 3 && (
                    <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                      Top {index + 1}
                    </Badge>
                  )}
                </div>

                {/* Mini Funnel Visualization */}
                <div className="space-y-3 mb-4">
                  {[
                    { stage: 'saves', metric: savesMetric, icon: Heart },
                    { stage: 'tags', metric: tagsMetric, icon: Tag },
                    { stage: 'projects', metric: projectsMetric, icon: FolderOpen }
                  ].map(({ stage, metric, icon: Icon }, stageIndex) => (
                    <div key={stage} className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <Icon className="w-4 h-4 text-folio-text-secondary flex-shrink-0" />
                        <div className="flex-1">
                          <div className="w-full bg-surface-elevated rounded-full h-3">
                            <div 
                              className="h-3 rounded-full bg-[#8C8278] transition-all duration-500"
                              style={{ width: `${metric.percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-folio-text-secondary min-w-0 flex-shrink-0">
                          {metric.value} ({metric.percentage.toFixed(0)}%)
                        </div>
                      </div>
                      {stageIndex < 2 && (
                        <ArrowRight className="w-3 h-3 text-folio-text-secondary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Asset Gap Badges */}
                {funnel.assetGaps.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-folio-text-secondary mb-2">Needed assets:</div>
                    <div className="flex flex-wrap gap-2">
                      {funnel.assetGaps.map((gap, gapIndex) => {
                        const IconComponent = getAssetGapIcon(gap);
                        return (
                          <Button
                            key={gapIndex}
                            size="sm"
                            variant="outline"
                            className="text-xs h-6"
                            onClick={() => onActionClick?.(funnel, getAssetGapLabel(gap))}
                          >
                            <IconComponent className="w-3 h-3 mr-1" />
                            {gap}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <div className="text-xs text-folio-text-secondary">
                    {funnel.assetGaps.length === 0 ? 'Complete asset set' : `${funnel.assetGaps.length} gaps`}
                  </div>
                  <div className="flex space-x-2">
                    {funnel.saveToTagRatePct >= 40 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => onActionClick?.(funnel, 'Run Close Offer')}
                      >
                        Close Offer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => onActionClick?.(funnel, 'Send Spec Pack')}
                    >
                      Spec Pack
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}









