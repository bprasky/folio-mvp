"use client";

export default function RsvpControl({ eventId }: { eventId: string }) {
  return (
    <button className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors">
      RSVP
    </button>
  );
}
