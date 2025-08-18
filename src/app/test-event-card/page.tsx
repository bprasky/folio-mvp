import EventCard from "@/components/events/EventCard";

export default function TestEventCardPage() {
  const sampleEvents = [
    {
      id: "event-1",
      title: "Design Week 2024",
      heroImageUrl: "/images/event-placeholder.jpg",
      startAt: "2024-03-15",
      endAt: "2024-03-20",
      city: "New York",
      country: "USA",
      festivalId: null, // Standalone event
    },
    {
      id: "event-2",
      title: "Product Launch Showcase",
      heroImageUrl: "/images/event-placeholder.jpg",
      startAt: "2024-03-16",
      endAt: "2024-03-16",
      city: "Los Angeles",
      country: "USA",
      festivalId: "festival-1", // Child event
    },
    {
      id: "event-3",
      title: "Sustainable Design Panel",
      heroImageUrl: null, // No image
      startAt: "2024-03-17",
      endAt: "2024-03-17",
      city: "San Francisco",
      country: "USA",
      festivalId: "festival-1", // Child event
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">EventCard Component Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sampleEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        
        <div className="mt-12 p-6 bg-white rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Notes:</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• First card: Standalone event (no festival)</li>
            <li>• Second card: Child event with image</li>
            <li>• Third card: Child event without image</li>
            <li>• All cards should be clickable and navigate to /events/[id]</li>
            <li>• Child events will show festival context on the event page</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 