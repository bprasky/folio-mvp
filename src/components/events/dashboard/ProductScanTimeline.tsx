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

export default function ProductScanTimeline({ eventId }: { eventId: string }) {
  const [data, setData] = useState<TimelineBucket[]>([]);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch(
          `/api/events/${eventId}/check-in/scan-timeline`
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
      <p className="text-sm text-stone-400 text-center py-6">
        No product scans yet — timeline will appear as products are scanned.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 'var(--type-eyebrow)', fill: "#78716c" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 'var(--type-eyebrow)', fill: "#78716c" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #e7e5e4",
            borderRadius: 8,
            fontSize: 'var(--type-meta)',
          }}
          formatter={(value: number) => [`${value} scans`, "Product Scans"]}
        />
        <Bar
          dataKey="count"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
