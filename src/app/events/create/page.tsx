"use client";
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../../contexts/RoleContext';
import { FaTimes, FaSearch, FaUserPlus, FaMapMarkerAlt, FaGlobe, FaUsers, FaRocket, FaUtensils, FaTags, FaCalendarAlt, FaImage, FaComments, FaRobot, FaFlag, FaCog } from 'react-icons/fa';
import ConciergeEventCreate from '../../../components/ConciergeEventCreate';
import ConciergeRecommendation from '../../../components/ConciergeRecommendation';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string;
}

const eventTypeOptions = [
  { label: "Panel", value: "PANEL" },
  { label: "Product Reveal", value: "PRODUCT_REVEAL" },
  { label: "Happy Hour", value: "HAPPY_HOUR" },
  { label: "Lunch & Learn", value: "LUNCH_AND_LEARN" },
  { label: "Installation", value: "INSTALLATION" },
  { label: "Exhibition", value: "EXHIBITION" },
  { label: "Booth", value: "BOOTH" },
  { label: "Party", value: "PARTY" },
  { label: "Meal", value: "MEAL" },
  { label: "Tour", value: "TOUR" },
  { label: "Awards", value: "AWARDS" },
  { label: "Workshop", value: "WORKSHOP" },
  { label: "Keynote", value: "KEYNOTE" },
  { label: "Other", value: "OTHER" },
];

export default function CreateEvent() {
  const { role } = useRole();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Main form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    isVirtual: false,
    timezone: '',
    mapLink: '',
    capacity: '',
    inviteType: 'open' as 'open' | 'invite-only' | 'followers',
    targetUserRoles: [] as string[],
    allowReshare: true,
    eventTypes: [] as string[],
    includesFood: false,
    rsvpDeadline: '',
    waitlistEnabled: false,
    allowChat: false,
    chatGroupLink: '',
    postEventMessage: '',
    linkedProducts: [] as string[],
    parentFestivalId: '', // Add festival selection
  });

  const [festivals, setFestivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  // Invitation states
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Custom inputs
  const [newProductSku, setNewProductSku] = useState('');
  
  // Concierge state
  const [showConcierge, setShowConcierge] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(true);

  useEffect(() => {
    async function fetchFestivals() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/festivals');
        const data = await res.json();
        if (Array.isArray(data)) {
          setFestivals(data);
        } else {
          setFestivals([]);
        }
      } catch (err) {
        setError('Failed to fetch festivals');
        setFestivals([]);
      } finally {
        setLoading(false);
      }
    }
    fetchFestivals();
  }, []);

  // Search users for invitations
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        if (res.ok) {
          const users = await res.json();
          setSearchResults(users);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (status === 'loading') return <div className="p-6">Loading...</div>;
  if (!role || !['admin', 'vendor'].includes(role)) {
    return <div className="p-6">Access Denied</div>;
  }

  const validateForm = () => {
    if (!form.title || !form.description || !form.location || !form.startDate || !form.endDate) {
      return 'All required fields must be filled';
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start >= end) {
      return 'End date must be after start date';
    }
    if (form.inviteType === 'invite-only' && invitedUserIds.length === 0 && invitedEmails.length === 0) {
      return 'Invite-only events must have at least one invited user or email';
    }
    if (form.eventTypes.length === 0) {
      return 'Please select at least one event type';
    }
    return null;
  };

  const addInvitedUser = (user: User) => {
    if (!invitedUserIds.includes(user.id)) {
      setInvitedUserIds([...invitedUserIds, user.id]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeInvitedUser = (userId: string) => {
    setInvitedUserIds(invitedUserIds.filter(id => id !== userId));
  };

  const addInvitedEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && !invitedEmails.includes(email)) {
      setInvitedEmails([...invitedEmails, email]);
      setNewEmail('');
    }
  };

  const removeInvitedEmail = (email: string) => {
    setInvitedEmails(invitedEmails.filter(e => e !== email));
  };

  const addProductSku = () => {
    const sku = newProductSku.trim();
    if (sku && !form.linkedProducts.includes(sku)) {
      setForm({ ...form, linkedProducts: [...form.linkedProducts, sku] });
      setNewProductSku('');
    }
  };

  const removeProductSku = (sku: string) => {
    setForm({ ...form, linkedProducts: form.linkedProducts.filter(s => s !== sku) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    
    try {
      const apiEndpoint = role === 'admin' ? '/api/admin/events' : '/api/vendors/events/create';
      const createdById = session?.user?.id;
      if (!createdById) {
        setError('User session not found. Please log in again.');
        return;
      }

      const formData = new FormData();
      
      // Basic event data
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('startDate', form.startDate);
      formData.append('endDate', form.endDate);
      formData.append('location', form.location);
      formData.append('createdById', createdById);
      
      // Festival association
      if (form.parentFestivalId) {
        formData.append('parentFestivalId', form.parentFestivalId);
      }
      
      // Location & Format
      formData.append('isVirtual', form.isVirtual.toString());
      formData.append('timezone', form.timezone);
      formData.append('mapLink', form.mapLink);
      
      // Audience & Visibility
      formData.append('inviteType', form.inviteType);
      formData.append('targetUserRoles', JSON.stringify(form.targetUserRoles));
      formData.append('allowReshare', form.allowReshare.toString());
      
      // RSVP & Capacity
      formData.append('capacity', form.capacity);
      formData.append('rsvpDeadline', form.rsvpDeadline);
      formData.append('waitlistEnabled', form.waitlistEnabled.toString());
      
      // Event Type & Food
      formData.append('eventTypes', JSON.stringify(form.eventTypes));
      formData.append('includesFood', form.includesFood.toString());
      
      // Community
      formData.append('allowChat', form.allowChat.toString());
      formData.append('chatGroupLink', form.chatGroupLink);
      formData.append('postEventMessage', form.postEventMessage);
      
      // Media & Products
      formData.append('linkedProducts', JSON.stringify(form.linkedProducts));
      
      // Add invitation data
      if (invitedUserIds.length > 0) {
        formData.append('invitedUserIds', JSON.stringify(invitedUserIds));
      }
      if (invitedEmails.length > 0) {
        formData.append('invitedEmails', JSON.stringify(invitedEmails));
      }
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create event');
      }
      
      // Track analytics
      try {
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'event_created',
            userId: createdById,
            eventTypes: form.eventTypes,
            includesFood: form.includesFood,
            capacity: form.capacity,
            inviteType: form.inviteType,
          })
        });
      } catch (err) {
        console.error('Analytics tracking failed:', err);
      }
      
      router.push('/events');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleConciergeSubmit = async (eventData: any) => {
    try {
      // Use the same submission logic as the regular form
      const apiEndpoint = role === 'admin' ? '/api/admin/events' : '/api/vendors/events/create';
      const createdById = session?.user?.id;
      if (!createdById) {
        setError('User session not found. Please log in again.');
        return;
      }

      // Send as JSON instead of FormData for concierge submissions
      const jsonData = {
        ...eventData,
        createdById,
        // Convert eventTypes array to eventType string for vendor API
        eventType: eventData.eventTypes && eventData.eventTypes.length > 0 ? eventData.eventTypes[0] : 'OTHER',
        // Include festival association if selected
        parentFestivalId: form.parentFestivalId || undefined
      };
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create event');
      }
      
      setShowConcierge(false);
      router.push('/events');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePromotionConfig = () => {
    // Navigate to promotion configurator page
    router.push('/events/promotion-configurator');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="ml-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Event</h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* 1. 🏁 Basic Event Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaFlag className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Basic Event Information</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter event title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    required
                  />
                </div>
                
                                 {role && ['admin', 'vendor'].includes(role) && (
                   <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Festival
                       <span className="text-gray-400 ml-1 text-xs">(optional)</span>
                     </label>
                     <select
                       value={form.parentFestivalId}
                       onChange={(e) => setForm({ ...form, parentFestivalId: e.target.value })}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                     >
                       <option value="">Select festival (optional)</option>
                       {festivals.map((festival) => (
                         <option key={festival.id} value={festival.id}>
                           {festival.title}
                         </option>
                       ))}
                     </select>
                     <p className="text-xs text-gray-500 mt-1">
                       Attach this event to a larger festival or program to help it show up in the correct feed.
                     </p>
                     {form.parentFestivalId && (
                       <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                         <p className="text-sm text-blue-700">
                           This event will appear in the {festivals.find(f => f.id === form.parentFestivalId)?.title} feed.
                         </p>
                       </div>
                     )}
                   </div>
                 )}
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    placeholder="Describe your event"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    min={new Date().toISOString().slice(0,16)}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. 📍 Location & Format */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaMapMarkerAlt className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Location & Format</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={form.isVirtual}
                      onChange={(e) => setForm({ ...form, isVirtual: e.target.checked })}
                      className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                    />
                    <span className="text-sm font-medium text-gray-700">Is Virtual Event</span>
                  </label>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    placeholder="Event location or virtual platform"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Map Link
                  </label>
                  <input
                    type="url"
                    placeholder="Google Maps or virtual meeting link"
                    value={form.mapLink}
                    onChange={(e) => setForm({ ...form, mapLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timezone
                  </label>
                  <select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  >
                    <option value="">Select timezone</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. 👥 Audience & Visibility */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaUsers className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Audience & Visibility</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invite Type
                  </label>
                  <select
                    value={form.inviteType}
                    onChange={(e) => setForm({ ...form, inviteType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  >
                    <option value="open">Open to all</option>
                    <option value="invite-only">Invite only</option>
                    <option value="followers">Followers only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target User Roles
                  </label>
                  <div className="space-y-2">
                    {['DESIGNER', 'VENDOR', 'HOMEOWNER'].map((role) => (
                      <label key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.targetUserRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, targetUserRoles: [...form.targetUserRoles, role] });
                            } else {
                              setForm({ ...form, targetUserRoles: form.targetUserRoles.filter(r => r !== role) });
                            }
                          }}
                          className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                        />
                        <span className="text-sm text-gray-700">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={form.allowReshare}
                      onChange={(e) => setForm({ ...form, allowReshare: e.target.checked })}
                      className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                    />
                    <span className="text-sm font-medium text-gray-700">Allow resharing</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 4. 🔢 RSVP & Capacity */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaCalendarAlt className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">RSVP & Capacity</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    placeholder="Maximum attendees"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSVP Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={form.rsvpDeadline}
                    onChange={(e) => setForm({ ...form, rsvpDeadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={form.waitlistEnabled}
                      onChange={(e) => setForm({ ...form, waitlistEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Waitlist</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 5. 🛍️ Media & Products */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaImage className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Media & Products</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Linked Products (SKUs)
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      placeholder="Add product SKU"
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProductSku())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={addProductSku}
                      className="px-3 py-2 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.linkedProducts.map((sku) => (
                      <span key={sku} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {sku}
                        <button
                          type="button"
                          onClick={() => removeProductSku(sku)}
                          className="ml-1 hover:text-red-600"
                        >
                          <FaTimes className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. 🍽️ Event Type & Food */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaUtensils className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Event Type & Food</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Types *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {eventTypeOptions.map(({ label, value }) => (
                      <label key={value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={form.eventTypes.includes(value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, eventTypes: [...form.eventTypes, value] });
                            } else {
                              setForm({ ...form, eventTypes: form.eventTypes.filter(t => t !== value) });
                            }
                          }}
                          className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={form.includesFood}
                      onChange={(e) => setForm({ ...form, includesFood: e.target.checked })}
                      className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                    />
                    <span className="text-sm font-medium text-gray-700">Includes Food/Drink</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 7. 💬 Community */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <FaComments className="text-folio-accent mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Community</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={form.allowChat}
                      onChange={(e) => setForm({ ...form, allowChat: e.target.checked })}
                      className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                    />
                    <span className="text-sm font-medium text-gray-700">Allow Chat</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chat Group Link
                  </label>
                  <input
                    type="url"
                    placeholder="Discord, Slack, or WhatsApp link"
                    value={form.chatGroupLink}
                    onChange={(e) => setForm({ ...form, chatGroupLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Post-Event Message
                  </label>
                  <textarea
                    placeholder="Message to send to attendees after the event"
                    value={form.postEventMessage}
                    onChange={(e) => setForm({ ...form, postEventMessage: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Invite-Only Configuration */}
            {form.inviteType === 'invite-only' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Invite Users</h2>
                
                {/* Search Existing Users */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search and invite existing users
                  </label>
                  <div className="relative">
                    <div className="flex items-center border border-gray-300 rounded-md">
                      <FaSearch className="ml-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                      />
                    </div>
                    
                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addInvitedUser(user)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              {user.profileImage ? (
                                <img src={user.profileImage} alt={user.name} className="w-8 h-8 rounded-full" />
                              ) : (
                                <span className="text-sm font-medium text-gray-600">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Invite by Email */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invite by email address
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInvitedEmail())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={addInvitedEmail}
                      className="px-4 py-2 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors flex items-center space-x-2"
                    >
                      <FaUserPlus />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Invited Users List */}
                {(invitedUserIds.length > 0 || invitedEmails.length > 0) && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Invited Users</h3>
                    
                    {/* Invited Existing Users */}
                    {invitedUserIds.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Users</h4>
                        <div className="space-y-2">
                          {invitedUserIds.map((userId) => {
                            const user = searchResults.find(u => u.id === userId);
                            return user ? (
                              <div key={userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                    {user.profileImage ? (
                                      <img src={user.profileImage} alt={user.name} className="w-8 h-8 rounded-full" />
                                    ) : (
                                      <span className="text-sm font-medium text-gray-600">
                                        {user.name.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{user.name}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeInvitedUser(userId)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <FaTimes />
                                </button>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Invited Emails */}
                    {invitedEmails.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Email Addresses</h4>
                        <div className="space-y-2">
                          {invitedEmails.map((email) => (
                            <div key={email} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                  <FaUserPlus className="text-gray-500" />
                                </div>
                                <div className="font-medium text-gray-900">{email}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeInvitedEmail(email)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handlePromotionConfig}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium flex items-center space-x-2"
              >
                <FaCog />
                <span>Configure Promotion</span>
              </button>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors font-medium"
                >
                  Create Event
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Floating Concierge Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowConcierge(true)}
          className="group relative bg-folio-accent text-white p-4 rounded-full shadow-lg hover:bg-folio-accent-dark transition-all duration-300 hover:scale-110"
        >
          <FaRobot className="w-6 h-6" />
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Skip the form, describe your event instead
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>
      </div>

      {/* Concierge Modal */}
      <ConciergeEventCreate
        isOpen={showConcierge}
        onClose={() => setShowConcierge(false)}
        onSubmit={handleConciergeSubmit}
      />

      {/* Concierge Recommendation */}
      <ConciergeRecommendation
        userRole={role || 'designer'}
        isFirstTimeUser={true} // You can determine this based on user data
        onTryConcierge={() => setShowConcierge(true)}
        onDismiss={() => setShowRecommendation(false)}
      />
    </div>
  );
} 