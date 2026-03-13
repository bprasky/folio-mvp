"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ArrivalTimeline from "./ArrivalTimeline";
import ProductScanTimeline from "./ProductScanTimeline";

type EventInfo = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

type Stats = {
  totalRsvps: number;
  checkedIn: number;
  walkIns: number;
  notYet: number;
  lastScan: string | null;
  productScans: number;
  avgScansPerPerson: number;
};

type Attendee = {
  rsvpId: string;
  userId: string;
  name: string;
  profileImage: string | null;
  title: string | null;
  role: string;
  orgName: string | null;
  status: string;
  checkedInAt: string | null;
  checkInMethod: string | null;
};

type Filter = "all" | "checked_in" | "not_yet" | "walk_in";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardClient({ event }: { event: EventInfo }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter !== "all") params.set("filter", filter);

    const [statsRes, attendeesRes] = await Promise.all([
      fetch(`/api/events/${event.id}/check-in/stats`),
      fetch(`/api/events/${event.id}/check-in/attendees?${params}`),
    ]);

    if (statsRes.ok) setStats(await statsRes.json());
    if (attendeesRes.ok) {
      const data = await attendeesRes.json();
      setAttendees(data.attendees ?? []);
    }
    setLoading(false);
  }, [event.id, filter, search]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "checked_in", label: "Checked In" },
    { key: "not_yet", label: "Not Yet" },
    { key: "walk_in", label: "Walk-Ins" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-base,#fdfbf8)]">
      {/* Header */}
      <div className="border-b border-[var(--border-light,#e7e5e4)] bg-white/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary,#1c1917)]">
              {event.title}
            </h1>
            <p className="text-xs text-[var(--text-secondary,#78716c)]">
              Live Dashboard
            </p>
          </div>
          <Link
            href={`/events/${event.id}/check-in`}
            className="text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Open Scanner
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            value={
              stats ? `${stats.checkedIn}/${stats.totalRsvps}` : "..."
            }
            label="Checked In"
          />
          <StatCard
            value={stats?.walkIns?.toString() ?? "..."}
            label="Walk-Ins"
          />
          <StatCard
            value={
              stats?.lastScan ? formatTime(stats.lastScan) : "—"
            }
            label="Last Scan"
          />
          <StatCard
            value={
              stats ? Math.max(0, stats.notYet).toString() : "..."
            }
            label="No-Shows"
          />
          <StatCard
            value={stats?.productScans?.toString() ?? "..."}
            label="Products Scanned"
          />
          <StatCard
            value={stats?.avgScansPerPerson?.toString() ?? "..."}
            label="Avg Scans/Person"
          />
        </div>

        {/* Arrival Timeline */}
        <div className="bg-white rounded-xl border border-[var(--border-light,#e7e5e4)] p-4">
          <h2 className="text-sm font-medium text-[var(--text-primary,#1c1917)] mb-3">
            Arrival Timeline
          </h2>
          <ArrivalTimeline eventId={event.id} />
        </div>

        {/* Product Scan Timeline */}
        <div className="bg-white rounded-xl border border-[var(--border-light,#e7e5e4)] p-4">
          <h2 className="text-sm font-medium text-[var(--text-primary,#1c1917)] mb-3">
            Product Scan Timeline
          </h2>
          <ProductScanTimeline eventId={event.id} />
        </div>

        {/* Attendee Table */}
        <div className="bg-white rounded-xl border border-[var(--border-light,#e7e5e4)] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f.key
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[var(--border-light,#e7e5e4)] px-3 py-1.5 text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-[var(--accent,#c8a97e)]"
            />
          </div>

          {loading ? (
            <p className="text-sm text-stone-400 text-center py-8">
              Loading...
            </p>
          ) : attendees.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">
              No attendees match this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs text-stone-500 uppercase tracking-wider">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4 hidden md:table-cell">Org</th>
                    <th className="pb-2 pr-4 hidden md:table-cell">Role</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a) => (
                    <tr
                      key={a.rsvpId}
                      className="border-b border-stone-50 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          {a.profileImage ? (
                            <img
                              src={a.profileImage}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-medium">
                              {a.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <span className="font-medium text-[var(--text-primary,#1c1917)] truncate max-w-[150px]">
                            {a.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-stone-500 hidden md:table-cell truncate max-w-[120px]">
                        {a.orgName || "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-stone-500 hidden md:table-cell">
                        {a.role}
                      </td>
                      <td className="py-2.5 pr-4">
                        {a.checkedInAt ? (
                          <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                            {a.checkInMethod === "walk_in"
                              ? "Walk-in"
                              : "In"}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-stone-500">
                        {a.checkedInAt
                          ? formatTime(a.checkedInAt)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border-light,#e7e5e4)] p-4 text-center">
      <p className="text-2xl font-semibold text-[var(--text-primary,#1c1917)]">
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary,#78716c)] mt-1">
        {label}
      </p>
    </div>
  );
}
