"use client";

import { useState, useCallback } from "react";
import BadgeScanner from "./BadgeScanner";
import ScanResult from "./ScanResult";
import ManualLookup from "./ManualLookup";
import StatsBar from "./StatsBar";

type EventInfo = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type Attendee = {
  id: string;
  name: string;
  profileImage: string | null;
  title: string | null;
  orgName: string | null;
};

export type ScanResultData =
  | { status: "checked_in"; checkedInAt: string; attendee: Attendee }
  | { status: "already_checked_in"; checkedInAt: string; attendee: Attendee }
  | { status: "not_found" }
  | { status: "invalid_qr" }
  | { status: "wrong_event" };

type ViewMode = "scanning" | "result" | "manual";

export default function CheckInPageClient({ event }: { event: EventInfo }) {
  const [mode, setMode] = useState<ViewMode>("scanning");
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [statsKey, setStatsKey] = useState(0);

  const handleScanResult = useCallback((data: ScanResultData) => {
    setResult(data);
    setMode("result");
    if (data.status === "checked_in") {
      setStatsKey((k) => k + 1);
    }
  }, []);

  const handleScanNext = useCallback(() => {
    setResult(null);
    setMode("scanning");
  }, []);

  const handleManualCheckIn = useCallback(() => {
    setStatsKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-base,#fdfbf8)]">
      {/* Header */}
      <div className="border-b border-[var(--border-light,#e7e5e4)] bg-white/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[var(--text-primary,#1c1917)] truncate">
              {event.title}
            </h1>
            <p className="text-xs text-[var(--text-secondary,#78716c)]">
              Check-In
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {mode === "scanning" && (
          <>
            <BadgeScanner
              eventId={event.id}
              onScanResult={handleScanResult}
            />
            <StatsBar
              key={statsKey}
              eventId={event.id}
              onManualLookup={() => setMode("manual")}
            />
          </>
        )}

        {mode === "result" && result && (
          <ScanResult
            result={result}
            eventId={event.id}
            onScanNext={handleScanNext}
            onWalkInAdded={() => {
              setStatsKey((k) => k + 1);
              handleScanNext();
            }}
          />
        )}

        {mode === "manual" && (
          <ManualLookup
            eventId={event.id}
            onBack={() => setMode("scanning")}
            onCheckIn={handleManualCheckIn}
          />
        )}
      </div>
    </div>
  );
}
