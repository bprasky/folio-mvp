"use client";

import { useState, useEffect } from "react";

type Props = {
  eventId: string;
  onManualLookup: () => void;
};

type Stats = {
  totalRsvps: number;
  checkedIn: number;
  walkIns: number;
  notYet: number;
  lastScan: string | null;
};

export default function StatsBar({ eventId, onManualLookup }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/events/${eventId}/check-in/stats`);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // ignore
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [eventId]);

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-[var(--text-secondary,#78716c)]">
        {stats
          ? `Checked in: ${stats.checkedIn} of ${stats.totalRsvps}`
          : "Loading..."}
      </p>
      <button
        onClick={onManualLookup}
        className="text-sm font-medium text-[var(--accent,#c8a97e)] hover:underline"
      >
        Manual Look-up
      </button>
    </div>
  );
}
