'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PhaseBreakdown } from "@/lib/mock/eventAnalytics";
import { FocusContext } from "@/lib/suggestions/types";

interface ProjectPhasesPieProps {
  data: PhaseBreakdown[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function ProjectPhasesPie({ data, onHover }: ProjectPhasesPieProps) {
  const chartData = data.map((item, index) => ({
    name: item.phase,
    value: item.pct,
    phase: item.phase,
    fill: getPhaseColor(item.phase)
  }));

  return (
    <div className="w-full h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            onMouseEnter={(data) => {
              if (onHover && data?.phase) {
                onHover({
                  type: 'phase',
                  key: data.phase,
                  data: data
                });
              }
            }}
            onMouseLeave={() => onHover?.(null)}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #DAD2CA',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            formatter={(value: number) => [`${value}%`, 'Percentage']}
            labelStyle={{ color: '#2B2B2B', fontWeight: '500' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function getPhaseColor(phase: string): string {
  const colors = {
    'Concept': '#8C8278',
    'Schematic': '#A69B8F',
    'FF&E': '#C4B5A6',
    'Procurement': '#DAD2CA'
  };
  return colors[phase as keyof typeof colors] || '#8C8278';
}
