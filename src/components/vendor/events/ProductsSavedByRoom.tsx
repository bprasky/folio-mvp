'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RoomSaves } from "@/lib/mock/eventAnalytics";
import { FocusContext } from "@/lib/suggestions/types";

interface ProductsSavedByRoomProps {
  data: RoomSaves[];
  onHover?: (ctx: FocusContext | null) => void;
}

export function ProductsSavedByRoom({ data, onHover }: ProductsSavedByRoomProps) {
  const chartData = data.map(item => ({
    room: item.room,
    saves: item.count,
    fill: getRoomColor(item.room)
  }));

  return (
    <div className="w-full h-[300px] min-h-[300px] min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
          onMouseEnter={(data) => {
            if (onHover && data?.activePayload?.[0]?.payload?.room) {
              const room = data.activePayload[0].payload.room;
              onHover({
                type: 'room',
                key: room,
                data: data.activePayload[0].payload
              });
            }
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D7" />
          <XAxis 
            dataKey="room" 
            tick={{ fontSize: 'var(--type-meta)', fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <YAxis 
            tick={{ fontSize: 'var(--type-meta)', fill: '#8C8278' }}
            axisLine={{ stroke: '#DAD2CA' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #DAD2CA',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ color: '#2B2B2B', fontWeight: 'var(--w-h1)' }}
          />
          <Bar 
            dataKey="saves" 
            radius={[4, 4, 0, 0]}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function getRoomColor(room: string): string {
  const colors = {
    'Kitchen': '#8C8278',
    'Bath': '#A69B8F',
    'Living': '#C4B5A6',
    'Bedroom': '#DAD2CA',
    'Outdoor': '#E5E0D7',
    'Other': '#F0EDE8'
  };
  return colors[room as keyof typeof colors] || '#8C8278';
}
