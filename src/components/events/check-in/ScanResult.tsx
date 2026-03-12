"use client";

import { useEffect, useState } from "react";
import type { ScanResultData, Attendee } from "./CheckInPageClient";

type Props = {
  result: ScanResultData;
  eventId: string;
  onScanNext: () => void;
  onWalkInAdded: () => void;
};

function AttendeeCard({ attendee }: { attendee: Attendee }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      {attendee.profileImage ? (
        <img
          src={attendee.profileImage}
          alt={attendee.name}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-medium text-lg">
          {attendee.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--text-primary,#1c1917)] truncate">
          {attendee.name}
        </p>
        {attendee.title && (
          <p className="text-sm text-[var(--text-secondary,#78716c)] truncate">
            {attendee.title}
          </p>
        )}
        {attendee.orgName && (
          <p className="text-sm text-[var(--text-secondary,#78716c)] truncate">
            {attendee.orgName}
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ScanResult({
  result,
  eventId,
  onScanNext,
  onWalkInAdded,
}: Props) {
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Auto-return to camera after 3s for success/already states
  useEffect(() => {
    if (
      result.status === "checked_in" ||
      result.status === "already_checked_in"
    ) {
      const timer = setTimeout(onScanNext, 3000);
      return () => clearTimeout(timer);
    }
    if (result.status === "invalid_qr" || result.status === "wrong_event") {
      const timer = setTimeout(onScanNext, 2000);
      return () => clearTimeout(timer);
    }
  }, [result.status, onScanNext]);

  async function handleAddWalkIn() {
    if (result.status !== "not_found") return;
    setAddingWalkIn(true);
    // Walk-in needs a userId — but not_found means no RSVP.
    // The scan endpoint returns not_found when badge token doesn't match any RSVP.
    // For walk-in from scanner, we redirect to manual lookup.
    onScanNext();
  }

  if (result.status === "checked_in") {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
        <p className="text-emerald-800 font-bold text-lg">WELCOME</p>
        <AttendeeCard attendee={result.attendee} />
        <p className="text-sm text-emerald-700 mt-3">
          Checked in at {formatTime(result.checkedInAt)}
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "already_checked_in") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
        <p className="text-amber-800 font-bold text-lg">ALREADY CHECKED IN</p>
        <AttendeeCard attendee={result.attendee} />
        <p className="text-sm text-amber-700 mt-3">
          Originally checked in at {formatTime(result.checkedInAt)}
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5">
        <p className="text-red-800 font-bold text-lg">NO RSVP FOUND</p>
        <p className="text-sm text-red-700 mt-2">
          Valid Folio badge, but no RSVP for this event.
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onScanNext}
            className="flex-1 py-2.5 rounded-lg bg-stone-200 text-stone-700 font-medium text-sm hover:bg-stone-300 transition-colors"
          >
            Scan Next
          </button>
        </div>
      </div>
    );
  }

  // invalid_qr or wrong_event
  return (
    <div className="rounded-xl bg-stone-100 border border-stone-200 p-5">
      <p className="text-stone-700 font-bold text-lg">Not a Folio Badge</p>
      <p className="text-sm text-stone-500 mt-2">
        This QR code is not a valid Folio badge. Try again.
      </p>
      <button
        onClick={onScanNext}
        className="mt-4 w-full py-2.5 rounded-lg bg-stone-300 text-stone-700 font-medium text-sm hover:bg-stone-400 transition-colors"
      >
        Scan Next
      </button>
    </div>
  );
}
