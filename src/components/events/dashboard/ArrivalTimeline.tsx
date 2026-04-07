"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TimelineBucket = {
  time: string;
  label: string;
  count: number;
};

export default function ArrivalTimeline({ eventId }: { eventId: string }) {
  const [data, setData] = useState<TimelineBucket[]>([]);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch(
          `/api/events/${eventId}/check-in/timeline`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json.timeline ?? []);
        }
      } catch {
        // ignore
      }
    }

    fetchTimeline();
    const interval = setInterval(fetchTimeline, 30000);
    return () => clearInterval(interval);
  }, [eventId]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-folio-text-tertiary text-center py-6">
        No check-ins yet — timeline will appear as guests arrive.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#78716c" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#78716c" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e7e5e4",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} guests`, "Check-ins"]}
        />
        <Bar
          dataKey="count"
          fill="#c8a97e"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
