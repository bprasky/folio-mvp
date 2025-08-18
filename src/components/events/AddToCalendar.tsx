"use client";

export default function AddToCalendar({ event }: { event: any }) {
  return (
    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
      Add to Calendar
    </button>
  );
}
