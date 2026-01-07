'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCalendarAlt, FaArrowLeft, FaSave, FaPlus } from 'react-icons/fa';
import Link from 'next/link';

interface CreateEventFormProps {
  userId: string;
}

const CreateEventForm: React.FC<CreateEventFormProps> = ({ userId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [eventType, setEventType] = useState<'festival' | 'event'>('festival');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    type: 'festival' as string,
    parentFestivalId: '',
  });

  const [availableFestivals, setAvailableFestivals] = useState<any[]>([]);

  // Load available festivals when switching to event mode
  const loadFestivals = async () => {
    try {
      const response = await fetch('/api/festivals');
      if (response.ok) {
        const festivals = await response.json();
        setAvailableFestivals(festivals);
      }
    } catch (error) {
      console.error('Error loading festivals:', error);
    }
  };

  const handleEventTypeChange = (type: 'festival' | 'event') => {
    setEventType(type);
    setFormData(prev => ({
      ...prev,
      type: type === 'festival' ? 'festival' : 'booth',
      parentFestivalId: '',
    }));
    
    if (type === 'event') {
      loadFestivals();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        startDate: formData.startDate,
        endDate: formData.endDate,
        type: formData.type,
        createdById: userId,
        ...(eventType === 'event' && formData.parentFestivalId 
          ? { parentFestivalId: formData.parentFestivalId }
          : {}),
      };

      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${eventType === 'festival' ? 'Festival' : 'Event'} created successfully!`);
        router.push('/admin/events');
      } else {
        const error = await response.json();
        alert(error.error || `Failed to create ${eventType}`);
        console.error(`Error creating ${eventType}:`, error);
      }
    } catch (error) {
      console.error(`Error creating ${eventType}:`, error);
      alert(`Failed to create ${eventType}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/events"
          className="flex items-center text-folio-text-muted hover:text-folio-accent transition-colors"
        >
          <FaArrowLeft className="mr-2" />
          Back to Events Dashboard
        </Link>
      </div>

      {/* Event Type Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
        <h2 className="text-xl font-semibold text-folio-text mb-4">What would you like to create?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleEventTypeChange('festival')}
            className={`p-6 rounded-lg border-2 transition-all ${
              eventType === 'festival' 
                ? 'border-folio-accent bg-folio-accent bg-opacity-10' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">🎪</div>
              <h3 className="font-semibold text-folio-text mb-2">Festival</h3>
              <p className="text-sm text-folio-text-muted">
                Create a multi-day design festival that vendors can submit events to
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleEventTypeChange('event')}
            className={`p-6 rounded-lg border-2 transition-all ${
              eventType === 'event' 
                ? 'border-folio-accent bg-folio-accent bg-opacity-10' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="font-semibold text-folio-text mb-2">Standalone Event</h3>
              <p className="text-sm text-folio-text-muted">
                Create a single event or add an event to an existing festival
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-folio-text mb-2">
              {eventType === 'festival' ? 'Festival' : 'Event'} Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              placeholder={`Enter ${eventType} title`}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-folio-text mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={4}
              className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              placeholder={`Describe your ${eventType}`}
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-folio-text mb-2">
              Location *
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              placeholder={`${eventType} location`}
            />
          </div>

          {/* Start and End Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-folio-text mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-folio-text mb-2">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                required
                min={formData.startDate}
                className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              />
            </div>
          </div>

          {/* Event Type (for standalone events) */}
          {eventType === 'event' && (
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-folio-text mb-2">
                Event Type *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              >
                <option value="booth">Booth</option>
                <option value="dinner">Dinner</option>
                <option value="panel">Panel</option>
                <option value="party">Party</option>
                <option value="workshop">Workshop</option>
                <option value="exhibition">Exhibition</option>
                <option value="networking">Networking</option>
              </select>
            </div>
          )}

          {/* Parent Festival Selection (for standalone events) */}
          {eventType === 'event' && (
            <div>
              <label htmlFor="parentFestivalId" className="block text-sm font-medium text-folio-text mb-2">
                Add to Festival (Optional)
              </label>
              <select
                id="parentFestivalId"
                name="parentFestivalId"
                value={formData.parentFestivalId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
              >
                <option value="">Standalone Event</option>
                {availableFestivals.map((festival) => (
                  <option key={festival.id} value={festival.id}>
                    {festival.title} ({new Date(festival.startDate).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <p className="text-sm text-folio-text-muted mt-1">
                Choose a festival to add this event to, or leave blank for a standalone event
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              {eventType === 'festival' ? 'Festival' : 'Event'} Information
            </h3>
            <div className="text-sm text-blue-800">
              {eventType === 'festival' ? (
                <>
                  <p>• Festivals are automatically approved and visible to vendors</p>
                  <p>• Vendors can submit events within your festival period</p>
                  <p>• All vendor events will require your approval before being published</p>
                </>
              ) : (
                <>
                  <p>• Admin events are automatically approved and visible to all users</p>
                  <p>• You can add this event to an existing festival or make it standalone</p>
                  <p>• Events show up in the main events feed and festival carousels</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-end space-x-4">
          <Link
            href="/admin/events"
            className="px-6 py-2 border border-folio-border text-folio-text rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Creating...
              </>
            ) : (
              <>
                <FaSave className="mr-2" />
                Create {eventType === 'festival' ? 'Festival' : 'Event'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateEventForm; 