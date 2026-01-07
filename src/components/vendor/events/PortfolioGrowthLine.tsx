'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PortfolioGrowthPoint } from "@/lib/mock/eventsPortfolio";
import { formatCompactNumber } from "@/lib/format";

interface PortfolioGrowthLineProps {
  data: PortfolioGrowthPoint[];
}

export function PortfolioGrowthLine({ data }: PortfolioGrowthLineProps) {
  const chartData = data.map(point => ({
    ...point,
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }));

  return (
    <div className="w-full h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
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
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white border border-[#DAD2CA] rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-[#2B2B2B] font-medium">{label}</p>
                    <p className="text-[#8C8278]">
                      Products Saved: <span className="font-semibold">{formatCompactNumber(payload[0].value)}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line 
            type="monotone" 
            dataKey="saves" 
            stroke="#8C8278" 
            strokeWidth={3}
            dot={{ fill: '#8C8278', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#8C8278', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}








