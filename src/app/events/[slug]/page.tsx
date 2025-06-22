'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaMapMarkerAlt, FaCalendarPlus, FaUserFriends, FaComment, FaImage, FaShoppingBag } from 'react-icons/fa';

// Mock data - in a real app, this would come from an API
const events = [
  {
    id: 1,
    title: 'Designers Meetup',
    slug: 'designers-meetup',
    host: { name: 'Lars Jensen', type: 'designer' },
    date: '2024-06-10T18:00:00',
    location: 'New York',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    description: 'Join us for an evening of networking and inspiration with fellow designers.',
    attendees: [
      { name: 'Ava Martinez', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', isDesignerPro: true },
      { name: 'Lars Jensen', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', isDesignerPro: false },
    ],
    gallery: [],
    comments: []
  },
  {
    id: 2,
    title: 'Spring Product Launch',
    slug: 'spring-product-launch',
    host: { name: 'Leaf & Co.', type: 'vendor' },
    date: '2024-06-14T19:00:00',
    location: 'Miami',
    image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=80',
    description: 'Be the first to see our new spring collection featuring sustainable and modern designs.',
    attendees: [
      { name: 'Kelly Wearstler', avatar: 'https://randomuser.me/api/portraits/women/45.jpg', isDesignerPro: true },
      { name: 'Norm Architects', avatar: 'https://randomuser.me/api/portraits/men/33.jpg', isDesignerPro: false },
    ],
    gallery: [
      { url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=400&q=80', user: 'Ava Martinez', time: '2h ago' },
      { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80', user: 'Norm Architects', time: '3h ago' }
    ],
    comments: [
      { author: 'Ava Martinez', text: 'Excited for this event!', time: '1h ago' },
      { author: 'You', text: 'Looking forward to seeing everyone!', time: 'just now' }
    ],
    featuredProducts: [
      { id: 101, name: "Eco Modular Sofa", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1583845112208-5eb7b0e24b0b?auto=format&fit=crop&w=800&q=80", price: "$2,499", desc: "Sustainable, modular seating for modern spaces." },
      { id: 102, name: "Biophilic Table Lamp", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80", price: "$320", desc: "Nature-inspired lighting for a calming ambiance." },
      { id: 103, name: "Textured Area Rug", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1583845112229-2b9fc29b5d9f?auto=format&fit=crop&w=800&q=80", price: "$799", desc: "Soft, tactile, and perfect for layering." },
      { id: 104, name: "Modern Planter Set", brand: "Leaf & Co.", image: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80", price: "$120", desc: "Minimalist planters for a biophilic touch." }
    ]
  }
];

export default function EventPage() {
  const params = useParams();
  const [event, setEvent] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState({
    name: 'You',
    isDesignerPro: true,
    follows: ['Leaf & Co.', 'Ava Martinez'],
    rsvp: false,
  });
  const [showGuestList, setShowGuestList] = useState(false);
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);
  const [rsvpAnimation, setRsvpAnimation] = useState(false);
  const [addedToCollection, setAddedToCollection] = useState<number[]>([]);
  const [savedMoodboard, setSavedMoodboard] = useState<string[]>([]);

  useEffect(() => {
    if (params?.slug) {
      const slug = params.slug;
      const foundEvent = events.find(e => e.slug === slug);
      if (foundEvent) {
        setEvent(foundEvent);
      }
    }
  }, [params?.slug]);

  if (!event) {
    return <div className="min-h-screen bg-gray-900 text-white p-8">Event not found</div>;
  }

  const eventDate = new Date(event.date);

  // RSVP Logic
  const updateRSVPBtn = () => {
    const now = new Date();
    if (now > eventDate) {
      return "Event Concluded";
    }
    if (currentUser.rsvp) {
      return "You're attending 🎉";
    } else {
      return "RSVP Now";
    }
  };

  const handleRSVP = () => {
    if (new Date() > eventDate) return;
    setCurrentUser(prev => ({ ...prev, rsvp: true }));
    if (!event.attendees.find((a: any) => a.name === currentUser.name)) {
      setEvent((prev: any) => ({
        ...prev,
        attendees: [
          ...prev.attendees,
          { name: currentUser.name, avatar: 'https://randomuser.me/api/portraits/men/39.jpg', isDesignerPro: true }
        ]
      }));
    }
    setRsvpAnimation(true);
    setTimeout(() => setRsvpAnimation(false), 1000);
  };

  // Add to Calendar
  const addToCalendar = () => {
    const start = new Date(event.date);
    const end = new Date(start.getTime() + 60*60*1000); // Add 1 hour
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${event.title}`,
      `LOCATION:${event.location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[400px]">
        <Image
          src={event.image}
          alt={event.title}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/50 flex items-end">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-2">{event.title}</h1>
            <div className="flex items-center gap-4 text-lg">
              <span className="flex items-center">
                <FaCalendarAlt className="mr-2" />
                {eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className="flex items-center">
                <FaMapMarkerAlt className="mr-2" />
                {event.location}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">About the Event</h2>
              <p className="text-gray-300 mb-6">{event.description}</p>
              
              {/* Host Info */}
              <div className="flex items-center gap-4 mb-6">
                <Image
                  src={event.host.avatar || 'https://randomuser.me/api/portraits/men/32.jpg'}
                  alt={event.host.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div>
                  <div className="font-semibold">Hosted by {event.host.name}</div>
                  <div className="text-sm text-gray-400">{event.host.type}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                <button
                  id="rsvp-btn"
                  onClick={handleRSVP}
                  className={`px-6 py-2 rounded-full font-semibold ${
                    currentUser.rsvp ? 'bg-green-500 text-black' : 'bg-blue-500 text-white'
                  }`}
                >
                  {updateRSVPBtn()}
                </button>
                <button
                  onClick={() => setShowGuestList(true)}
                  className="px-6 py-2 rounded-full bg-gray-700 text-white font-semibold flex items-center gap-2"
                >
                  <FaUserFriends />
                  See Guest List
                </button>
                <button
                  onClick={addToCalendar}
                  className="px-6 py-2 rounded-full bg-gray-700 text-white font-semibold flex items-center gap-2"
                >
                  <FaCalendarPlus />
                  Add to Calendar
                </button>
              </div>
            </div>

            {/* Gallery Section */}
            {event.gallery && event.gallery.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FaImage />
                  Event Gallery
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {event.gallery.map((photo: any, index: number) => (
                    <div key={index} className="relative">
                      <Image
                        src={photo.url}
                        alt={`Gallery image ${index + 1}`}
                        width={300}
                        height={200}
                        className="rounded-lg"
                      />
                      <div className="absolute bottom-2 left-2 text-sm bg-black/50 px-2 py-1 rounded">
                        {photo.user}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            {event.comments && event.comments.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FaComment />
                  Discussion
                </h2>
                <div className="space-y-4">
                  {event.comments.map((comment: any, index: number) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{comment.author}</span>
                        <span className="text-sm text-gray-400">{comment.time}</span>
                      </div>
                      <p>{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1">
            {/* Featured Products */}
            {event.featuredProducts && event.featuredProducts.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <FaShoppingBag />
                  Featured Products
                </h2>
                <div className="space-y-4">
                  {event.featuredProducts.map((product: any) => (
                    <div key={product.id} className="bg-gray-700 rounded-lg p-4">
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={200}
                        height={150}
                        className="rounded-lg mb-3"
                      />
                      <div className="font-semibold">{product.name}</div>
                      <div className="text-sm text-gray-400">By {product.brand}</div>
                      <div className="text-amber-300 font-semibold mt-1">{product.price}</div>
                      <button
                        className={`w-full mt-3 px-4 py-2 rounded-full ${
                          addedToCollection.includes(product.id)
                            ? 'bg-green-700 text-white'
                            : 'bg-green-500 text-black'
                        } font-semibold`}
                        onClick={() => setAddedToCollection(prev => [...prev, product.id])}
                      >
                        {addedToCollection.includes(product.id) ? 'Added!' : 'Add to Collection'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 