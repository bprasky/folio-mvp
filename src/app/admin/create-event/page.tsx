'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../../contexts/RoleContext';
import Navigation from '../../../components/Navigation';
import { FaCalendarAlt, FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';
import Link from 'next/link';

export default function CreateEventPage() {
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
    hostType: 'admin',
    hostName: '',
    maxAttendees: '',
    isPublic: true,
    featuredDesignerId: '',
    productIds: [] as string[]
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not admin
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-folio-background flex">
        <Navigation />
        <div className="flex-1 lg:ml-20 xl:ml-56 flex items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-folio-text mb-2">Admin Only</h2>
            <p className="text-folio-border">Access denied. Admin privileges required.</p>
          </div>
        </div>
      </div>
    );
  }

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
        createdById: 'admin-user-id', // In a real app, this would be the current user's ID
        hostId: role === 'admin' ? 'admin-user-id' : null,
        hostName: formData.hostName || 'Admin'
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

      setSuccess('Event created successfully!');
      setTimeout(() => {
        router.push('/admin?tab=events');
      }, 2000);
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
              href="/admin"
              className="inline-flex items-center gap-2 text-folio-accent hover:text-folio-accent-hover mb-4"
            >
              <FaArrowLeft className="w-4 h-4" />
              Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-folio-text mb-2">Create New Event</h1>
            <p className="text-folio-border">Create events like design festivals, vendor showcases, and community meetups</p>
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
                  <p className="text-green-600">{success}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    placeholder="e.g., Design Festival 2024"
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
                    placeholder="design-festival-2024"
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
                    placeholder="e.g., New York, NY"
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

                {/* Host Type */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Host Type
                  </label>
                  <select
                    name="hostType"
                    value={formData.hostType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                  >
                    <option value="admin">Admin</option>
                    <option value="designer">Designer</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>

                {/* Host Name */}
                <div>
                  <label className="block text-sm font-medium text-folio-text mb-2">
                    Host Name
                  </label>
                  <input
                    type="text"
                    name="hostName"
                    value={formData.hostName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-folio-border rounded-lg focus:ring-2 focus:ring-folio-accent focus:border-folio-accent"
                    placeholder="e.g., Design Festival Team"
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
                  href="/admin"
                  className="px-6 py-3 border border-folio-border text-folio-text rounded-lg hover:bg-folio-muted transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FaPlus className="w-4 h-4" />
                      Create Event
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