'use client';

interface FestivalEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  imageUrl?: string;
  rsvp_count: number;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
}

interface FestivalEventsListProps {
  events: FestivalEvent[];
}

export default function FestivalEventsList({ events }: FestivalEventsListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No events scheduled for this festival yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Festival Events</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {event.imageUrl && (
              <div className="aspect-video overflow-hidden">
                <img
                  src={event.imageUrl}
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{event.name}</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p className="flex items-center">
                  <span className="font-medium">Date:</span>
                  <span className="ml-2">{new Date(event.date).toLocaleDateString()}</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium">Time:</span>
                  <span className="ml-2">{event.time}</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium">Location:</span>
                  <span className="ml-2">{event.location}</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium">RSVPs:</span>
                  <span className="ml-2">{event.rsvp_count}</span>
                </p>
                <p className="flex items-center">
                  <span className="font-medium">Organizer:</span>
                  <span className="ml-2">{event.createdBy.name}</span>
                </p>
              </div>
              {event.description && (
                <p className="mt-3 text-sm text-gray-700">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 