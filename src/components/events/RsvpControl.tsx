"use client";

export default function RsvpControl({ eventId }: { eventId: string }) {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      RSVP
    </button>
  );
}
