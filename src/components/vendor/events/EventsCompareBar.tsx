'use client';

import { useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { EventSummary } from "@/lib/mock/eventsPortfolio";
import { formatCompactNumber } from "@/lib/format";

interface EventsCompareBarProps {
  events: EventSummary[];
  averages: {
    avgRsvps: number;
    avgSaves: number;
    avgValueUsd: number;
  };
  onEventClick?: (eventId: string) => void;
  onHover?: (eventId: string | null) => void;
}

export function EventsCompareBar({ events, averages, onEventClick, onHover }: EventsCompareBarProps) {
  const chartData = events.map(event => ({
    eventId: event.id,
    name: event.name.replace(' 2026', '').replace(' 2025', ''), // Shorten names
    rsvps: event.rsvps,
    saves: event.saves,
    estValue: Math.round(event.estValueUsd / 1000000), // Convert to millions
    avgRsvps: averages.avgRsvps,
    avgSaves: averages.avgSaves,
    avgEstValue: Math.round(averages.avgValueUsd / 1000000)
  }));

  const handleEventClick = useCallback((eventId: string) => {
    onEventClick?.(eventId);
  }, [onEventClick]);

  const handleBarMouseEnter = useCallback((data: any) => {
    onHover?.(data.eventId);
  }, [onHover]);

  const handleBarMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  return (
    <div className="w-full h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          onMouseMove={(data) => {
            if (data?.activePayload?.[0]?.payload) {
              handleBarMouseEnter(data.activePayload[0].payload);
            }
          }}
          onMouseLeave={handleBarMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D7" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div 
                    className="bg-white border border-[#DAD2CA] rounded-lg px-4 py-3 shadow-lg cursor-pointer"
                    onClick={() => handleEventClick(data.eventId)}
                  >
                    <p className="text-[#2B2B2B] font-medium mb-2">{label}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-[#8C8278]">
                        RSVPs: <span className="font-semibold text-[#2B2B2B]">{formatCompactNumber(data.rsvps)}</span>
                      </p>
                      <p className="text-[#8C8278]">
                        Saves: <span className="font-semibold text-[#2B2B2B]">{formatCompactNumber(data.saves)}</span>
                      </p>
                      <p className="text-[#8C8278]">
                        Est. Value: <span className="font-semibold text-[#2B2B2B]">${data.estValue}M</span>
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Average lines */}
          <ReferenceLine 
            y={averages.avgRsvps} 
            stroke="#8C8278" 
            strokeDasharray="5 5" 
            strokeOpacity={0.6}
            label={{ value: "Avg RSVPs", position: "topRight", fontSize: 11, fill: "#8C8278" }}
          />
          {/* Bars */}
          <Bar 
            dataKey="rsvps" 
            fill="#8C8278" 
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
