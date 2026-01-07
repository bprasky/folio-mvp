'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RoomPhaseCell, Room, Phase } from "@/lib/mock/eventPost";
import { formatPercentage } from "@/lib/format";
import { getRoomPhaseSuggestions, type PostSuggestion } from "@/lib/suggestions/postRules";

interface RoomPhaseMatrixProps {
  data: RoomPhaseCell[];
  onHover?: (suggestions: PostSuggestion[]) => void;
}

export function RoomPhaseMatrix({ data, onHover }: RoomPhaseMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<RoomPhaseCell | null>(null);

  const rooms: Room[] = ["Kitchen", "Bath", "Living", "Bedroom", "Outdoor", "Other"];
  const phases: Phase[] = ["Concept", "Schematic", "FF&E", "Procurement"];

  const getCellData = (room: Room, phase: Phase): RoomPhaseCell | undefined => {
    return data.find(cell => cell.room === room && cell.phase === phase);
  };

  const handleCellHover = (cell: RoomPhaseCell | null) => {
    setHoveredCell(cell);
    if (cell && onHover) {
      const suggestions = getRoomPhaseSuggestions(cell);
      onHover(suggestions);
    } else if (onHover) {
      onHover([]);
    }
  };

  const getIntensityColor = (rate: number): string => {
    if (rate >= 60) return 'bg-green-500';
    if (rate >= 40) return 'bg-yellow-500';
    if (rate >= 20) return 'bg-orange-500';
    return 'bg-gray-300';
  };

  return (
    <Card className="bg-white border-[#DAD2CA]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#2B2B2B]">
          Room × Phase Matrix
        </CardTitle>
        <p className="text-sm text-[#8C8278]">
          Real use cases by phase. Hover cells for insights.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header with phases */}
            <div className="flex">
              <div className="w-24 flex-shrink-0" /> {/* Empty corner */}
              {phases.map((phase) => (
                <div key={phase} className="flex-1 text-center py-3 px-2">
                  <p className="text-sm font-medium text-[#2B2B2B]">{phase}</p>
                </div>
              ))}
            </div>

            {/* Rows with room data */}
            {rooms.map((room) => (
              <div key={room} className="flex border-t border-[#DAD2CA]">
                {/* Room label */}
                <div className="w-24 flex-shrink-0 px-3 py-4 border-r border-[#DAD2CA]">
                  <p className="text-sm font-medium text-[#2B2B2B]">{room}</p>
                </div>

                {/* Phase cells */}
                {phases.map((phase) => {
                  const cell = getCellData(room, phase);
                  if (!cell) return <div key={phase} className="flex-1 border-b border-[#DAD2CA]" />;

                  const isHovered = hoveredCell?.room === cell.room && hoveredCell?.phase === cell.phase;

                  return (
                    <TooltipProvider key={phase}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 p-3 border-r border-[#DAD2CA] cursor-pointer transition-colors ${
                              isHovered ? 'bg-[#F7F4F1]' : 'hover:bg-gray-50'
                            }`}
                            onMouseEnter={() => handleCellHover(cell)}
                            onMouseLeave={() => handleCellHover(null)}
                          >
                            <div className="text-center space-y-2">
                              <p className="text-xs text-[#8C8278]">
                                {formatPercentage(cell.saveToTagRatePct, 1)}
                              </p>
                              
                              {/* Intensity bar */}
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${getIntensityColor(cell.saveToTagRatePct)} transition-all duration-200`}
                                  style={{ width: `${Math.min(cell.saveToTagRatePct, 100)}%` }}
                                />
                              </div>

                              <div className="text-xs text-[#2B2B2B] space-y-1">
                                <p>{cell.saves} saves</p>
                                <p>{cell.tags} tags</p>
                              </div>

                              {cell.assetGap && (
                                <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                                  {cell.assetGap} gap
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2">
                            <p className="font-medium">{room} - {phase}</p>
                            <p className="text-sm">
                              {cell.saves} saves, {cell.tags} tags
                            </p>
                            <p className="text-sm">
                              {formatPercentage(cell.saveToTagRatePct, 1)} save-to-tag rate
                            </p>
                            {cell.assetGap && (
                              <p className="text-sm text-orange-600">
                                Asset gap: {cell.assetGap}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Action Chips */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-[#DAD2CA]">
          <Button variant="outline" size="sm" className="text-xs">
            Send Spec Pack
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            Boost Case Study
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            Request Renders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
