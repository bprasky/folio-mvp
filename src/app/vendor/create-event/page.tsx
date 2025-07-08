'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../../contexts/RoleContext';
import Navigation from '../../../components/Navigation';
import { FaCalendarAlt, FaArrowLeft, FaPlus, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import Link from 'next/link';

interface Festival {
  id: string;
  title: string;
  slug: string;
  date: string;
  location: string;
}

export default function VendorCreateEventPage() {
  const { role } = useRole();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    date: '',
    time: '',
    location: '',
    coverImage: '',
    hostName: '',
    maxAttendees: '',
    isPublic: true,
    parentEventId: ''
  });

  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFestivals, setLoadingFestivals] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not vendor
  if (role !== 'vendor') {
    return (
      <div className="min-h-screen bg-folio-background flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-folio-text mb-2">Vendor Only</h2>
            <p className="text-folio-border">Access denied. Vendor privileges required.</p>
          </div>
        </div>
      </div>
    );
  }

  // Load available festivals
  useEffect(() => {
    loadFestivals();
  }, []);

  const loadFestivals = async () => {
    try {
      const response = await fetch('/api/events?type=festival&includeApproved=true');
      const data = await response.json();
      
      // Only show future festivals
      const futureFestivals = data.filter((festival: any) => {
        return new Date(festival.date) > new Date();
      });
      
      setFestivals(futureFestivals);
    } catch (error) {
      console.error('Error loading festivals:', error);
      setError('Failed to load available festivals');
    } finally {
      setLoadingFestivals(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Combine date and time for the datetime field
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      
      const eventData = {
        ...formData,
        date: dateTime.toISOString(),
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        createdById: 'vendor-user-id', // In a real app, this would be the current user's ID
        createdByRole: 'vendor',
        hostType: 'vendor',
        hostId: 'vendor-user-id',
        hostName: formData.hostName || 'Vendor',
        eventType: 'event'
      };

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create event');
      }

      setSuccess('Event submitted for approval! You will be notified once it has been reviewed by the festival organizers.');
      setTimeout(() => {
        router.push('/vendor');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-folio-background flex">
      <Navigation />
      
      <div className="flex-1 lg:ml-20 xl:ml-56">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/vendor"
              className="inline-flex items-center gap-2 text-folio-accent hover:text-folio-accent-hover mb-4"
            >
              <FaArrowLeft className="w-4 h-4" />
              Back to Vendor Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-folio-text mb-2">Create Event</h1>
            <p className="text-folio-border">Create an event within a design festival or showcase</p>
          </div>

          {/* Approval Notice */}
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FaExclamationTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800 mb-1">Approval Required</h3>
                <p className="text-sm text-amber-700">
                  Events created by vendors are subject to approval by festival organizers. 
                  You will be notified once your event has been reviewed.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl shadow-sm border border-folio-border">
            <form onSubmit={handleSubmit} className="p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FaClock className="w-5 h-5 text-green-600 mt-0.5" />
                    <p className="text-green-600">{success}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Festival Selection */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Festival *
                  </label>
                  {loadingFestivals ? (
                    <div className="w-full px-4 py-2 border border-folio-border rounded-lg bg-gray-50">
                      Loading festivals...
                    </div>
                  ) : (
                    <select
                      name="parentEventId"
                      value={formData.parentEventId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    >
                      <option value="">Select a festival</option>
                      {festivals.map((festival) => (
                        <option key={festival.id} value={festival.id}>
                          {festival.title} - {new Date(festival.date).toLocaleDateString()} - {festival.location}
                        </option>
                      ))}
                    </select>
                  )}
                  {festivals.length === 0 && !loadingFestivals && (
                    <p className="text-sm text-folio-border mt-1">
                      No upcoming festivals available. Events can only be created within existing festivals.
                    </p>
                  )}
                </div>

                {/* Event Title */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleTitleChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="e.g., Product Showcase at Design Festival"
                  />
                </div>

                {/* Slug */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="product-showcase-design-festival"
                  />
                  <p className="text-sm text-folio-border mt-1">
                    URL will be: /events/{formData.slug}
                  </p>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="Describe your event..."
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Time *
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="e.g., Booth #12, Main Hall"
                  />
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Cover Image URL *
                  </label>
                  <input
                    type="url"
                    name="coverImage"
                    value={formData.coverImage}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                {/* Host Name */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Host/Company Name
                  </label>
                  <input
                    type="text"
                    name="hostName"
                    value={formData.hostName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="e.g., Your Company Name"
                  />
                </div>

                {/* Max Attendees */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Max Attendees
                  </label>
                  <input
                    type="number"
                    name="maxAttendees"
                    value={formData.maxAttendees}
                    onChange={handleInputChange}
                    min="1"
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                {/* Public Event */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-folio-accent focus:ring-folio-accent border-folio-border rounded"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-folio-text">
                    Public Event
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end gap-4">
                <Link
                  href="/vendor"
                  className="px-6 py-3 border border-folio-border text-folio-text rounded-lg hover:bg-folio-muted transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading || festivals.length === 0}
                  className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting for Approval...
                    </>
                  ) : (
                    <>
                      <FaPlus className="w-4 h-4" />
                      Submit Event for Approval
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}