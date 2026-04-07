"use client";

import { useState, useEffect, useCallback } from "react";

type AttendeeRow = {
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

type Props = {
  eventId: string;
  onBack: () => void;
  onCheckIn: () => void;
};

export default function ManualLookup({ eventId, onBack, onCheckIn }: Props) {
  const [search, setSearch] = useState("");
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(
        `/api/events/${eventId}/check-in/attendees?${params}`
      );
      const data = await res.json();
      setAttendees(data.attendees ?? []);
    } catch {
      setAttendees([]);
    }
    setLoading(false);
  }, [eventId, search]);

  useEffect(() => {
    const timer = setTimeout(fetchAttendees, 300);
    return () => clearTimeout(timer);
  }, [fetchAttendees]);

  async function handleCheckIn(userId: string) {
    setCheckingIn(userId);
    try {
      await fetch(`/api/events/${eventId}/check-in/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      onCheckIn();
      fetchAttendees();
    } catch {
      // ignore
    }
    setCheckingIn(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary,#1c1917)]">
          Manual Check-In
        </h2>
        <button
          onClick={onBack}
          className="text-sm text-[var(--text-secondary,#78716c)] hover:text-[var(--text-primary,#1c1917)] transition-colors"
        >
          Back to Scanner
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-light,#e7e5e4)] bg-surface-canvas px-4 py-2.5 text-sm text-[var(--text-primary,#1c1917)] placeholder:text-[var(--text-tertiary,#a8a29e)] focus:outline-none focus:ring-2 focus:ring-[var(--accent,#c8a97e)] mb-4"
        autoFocus
      />

      {/* Attendee List */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary,#78716c)] text-center py-8">
          Loading...
        </p>
      ) : attendees.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary,#78716c)] text-center py-8">
          {search ? "No matching guests found." : "No RSVPs for this event."}
        </p>
      ) : (
        <div className="space-y-2">
          {attendees.map((a) => (
            <div
              key={a.rsvpId}
              className="flex items-center justify-between rounded-lg bg-surface-canvas border border-[var(--border-light,#e7e5e4)] p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {a.profileImage ? (
                  <img
                    src={a.profileImage}
                    alt={a.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-folio-text-tertiary font-medium text-sm flex-shrink-0">
                    {a.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary,#1c1917)] truncate">
                    {a.name}
                  </p>
                  {a.orgName && (
                    <p className="text-xs text-[var(--text-secondary,#78716c)] truncate">
                      {a.orgName}
                    </p>
                  )}
                </div>
              </div>

              {a.checkedInAt ? (
                <span className="text-emerald-600 text-sm font-medium flex-shrink-0">
                  In
                </span>
              ) : (
                <button
                  onClick={() => handleCheckIn(a.userId)}
                  disabled={checkingIn === a.userId}
                  className="text-sm font-medium px-3 py-1.5 rounded-md bg-[var(--accent,#c8a97e)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                >
                  {checkingIn === a.userId ? "..." : "Check In"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--text-tertiary,#a8a29e)] text-center mt-4">
        Showing RSVP&apos;d guests{!search && " — search to filter"}
      </p>
    </div>
  );
}
