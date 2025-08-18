"use client";
import { useEffect, useState } from "react";

type InsightBarProps = {
  event: {
    id: string;
    rsvps?: Array<{ status?: string | null }> | null;
  };
};

export default function InsightBar({ event }: InsightBarProps) {
  const [liveCounts, setLiveCounts] = useState<{attending:number; interested:number} | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${event.id}/rsvp`, { method: "GET" });
        const json = await res.json();
        if (mounted && json?.ok) setLiveCounts(json.counts);
      } catch {}
    };
    load();
    const t = setInterval(load, 20000); // gentle poll
    return () => { mounted = false; clearInterval(t); };
  }, [event.id]);

  const rsvps = event.rsvps || [];
  const attending = liveCounts?.attending ?? rsvps.filter((r) => (r.status || "").toUpperCase() === "ATTENDING").length;
  const interested = liveCounts?.interested ?? rsvps.filter((r) => (r.status || "").toUpperCase() === "INTERESTED").length;

  // Other numbers are placeholders until wired to analytics
  const views = "—";
  const calAdds = "—";
  const prodSaves = "—";
  const follows = "—";

  const Pill = ({ label, value }: { label: string; value: string | number }) => (
    <div className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-sm">
      <span className="font-medium">{value}</span> <span className="text-gray-500">{label}</span>
    </div>
  );

  return (
    <div className="w-full border border-folio-border rounded-xl bg-white shadow-sm px-4 py-3 flex flex-wrap gap-2">
      <Pill label="views" value={views} />
      <Pill label="RSVPs (attending)" value={attending} />
      <Pill label="RSVPs (interested)" value={interested} />
      <Pill label="calendar adds" value={calAdds} />
      <Pill label="product saves" value={prodSaves} />
      <Pill label="follows" value={follows} />
    </div>
  );
} 