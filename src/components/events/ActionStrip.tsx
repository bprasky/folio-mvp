"use client";
import { useMemo, useState } from "react";
import { track } from "@/lib/analytics";

type ActionStripProps = {
  event: {
    id: string;
    title?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    location?: string | null;
    createdBy?: { id: string; name?: string | null; companyName?: string | null } | null;
    parentFestivalId?: string | null;
  };
};

function toDate(d?: string | Date | null) {
  if (!d) return null;
  return typeof d === "string" ? new Date(d) : d;
}

function googleCalUrl(e: ActionStripProps["event"]) {
  const start = toDate(e.startDate);
  const end = toDate(e.endDate) || start;
  if (!start) return "#";
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const qs = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title || "Event",
    dates: `${fmt(start)}/${fmt(end || start)}`,
    details: e.title || "",
    location: e.location || "",
  }).toString();
  return `https://calendar.google.com/calendar/render?${qs}`;
}

export default function ActionStrip({ event }: ActionStripProps) {
  const [rsvp, setRsvp] = useState<"ATTENDING" | "INTERESTED" | "SEND_TO_TEAM" | null>(null);
  const vendorName = event.createdBy?.companyName || event.createdBy?.name || "Vendor";
  const gcal = useMemo(() => googleCalUrl(event), [event]);

  const onRSVP = async (next: typeof rsvp) => {
    setRsvp(next);
    track("event_rsvp_click", { eventId: event.id, state: next });
    try {
      const res = await fetch(`/api/events/${event.id}/rsvp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      // optional: you can read counts here and raise a custom event to refresh InsightBar
      // const data = await res.json();
    } catch (e) {
      // roll back on error (optional)
      console.warn("RSVP update failed", e);
    }
  };

  const onFollow = () => {
    track("vendor_follow_click", { vendorId: event.createdBy?.id, eventId: event.id });
  };

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title || "Event", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      track("event_share", { eventId: event.id });
    } catch {
      // swallow
    }
  };

  return (
    <div className="w-full border border-folio-border rounded-xl bg-white shadow-sm px-4 py-3 flex flex-wrap items-center gap-2">
      <div className="font-medium mr-2">Quick actions:</div>

      <div className="flex items-center gap-1 mr-3">
        <button
          onClick={() => onRSVP("ATTENDING")}
          className={`px-3 py-1 rounded-full border text-sm ${
            rsvp === "ATTENDING"
              ? "bg-folio-accent text-white border-folio-accent"
              : "bg-white hover:bg-gray-50 border-gray-300"
          }`}
        >
          Attending
        </button>
        <button
          onClick={() => onRSVP("INTERESTED")}
          className={`px-3 py-1 rounded-full border text-sm ${
            rsvp === "INTERESTED"
              ? "bg-folio-accent/90 text-white border-folio-accent"
              : "bg-white hover:bg-gray-50 border-gray-300"
          }`}
        >
          Interested
        </button>
        <button
          onClick={() => onRSVP("SEND_TO_TEAM")}
          className={`px-3 py-1 rounded-full border text-sm ${
            rsvp === "SEND_TO_TEAM"
              ? "bg-folio-accent/80 text-white border-folio-accent"
              : "bg-white hover:bg-gray-50 border-gray-300"
          }`}
        >
          Send to team
        </button>
      </div>

      <a
        href={gcal}
        target="_blank"
        rel="noreferrer"
        onClick={() => track("calendar_add_click", { eventId: event.id, type: "google" })}
        className="px-3 py-1 rounded-full border border-gray-300 text-sm bg-white hover:bg-gray-50"
      >
        Add to Google Calendar
      </a>

      <button
        onClick={onFollow}
        className="px-3 py-1 rounded-full border border-gray-300 text-sm bg-white hover:bg-gray-50"
      >
        Follow {vendorName}
      </button>

      <button
        onClick={onShare}
        className="px-3 py-1 rounded-full border border-gray-300 text-sm bg-white hover:bg-gray-50"
      >
        Share
      </button>
    </div>
  );
} 