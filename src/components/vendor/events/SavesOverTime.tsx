'use client';

import { useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TimeSeriesPoint } from "@/lib/mock/eventAnalytics";
import { formatDate } from "@/lib/format";
import { FocusContext } from "@/lib/suggestions/types";

interface SavesOverTimeProps {
  data: TimeSeriesPoint[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function SavesOverTime({ data, onHover }: SavesOverTimeProps) {
  const chartData = data.map(point => ({
    date: formatDate(point.date, { month: 'short', day: 'numeric' }),
    saves: point.saves,
    fullDate: point.date
  }));

  const TooltipContent = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#DAD2CA] rounded-lg px-3 py-2 shadow-lg">
          <p className="text-[#2B2B2B] font-medium">{label}</p>
          <p className="text-[#8C8278]">
            Saves: <span className="font-semibold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((data: any) => {
    if (onHover && data?.activePayload?.[0]?.payload?.fullDate) {
      const date = data.activePayload[0].payload.fullDate;
      onHover({
        type: 'time',
        key: date,
        data: data.activePayload[0].payload
      });
    }
  }, [onHover]);

  const handleMouseLeave = useCallback(() => {
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  return (
    <div className="w-full h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D7" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <Tooltip content={<TooltipContent />} />
          <Line 
            type="monotone" 
            dataKey="saves" 
            stroke="#8C8278" 
            strokeWidth={2.5}
            dot={{ fill: '#8C8278', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#8C8278', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
