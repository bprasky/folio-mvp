'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Festival {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
}

export default function CreateEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    parentFestivalId: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
      return;
    }

    if (session?.user?.role !== 'vendor') {
      router.push('/');
      return;
    }

    fetchFestivals();
  }, [session, status, router]);

  const fetchFestivals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/festivals/active');
      if (!response.ok) {
        throw new Error('Failed to fetch festivals');
      }
      const data = await response.json();
      setFestivals(data);
    } catch (error) {
      console.error('Error fetching festivals:', error);
      alert('Failed to load festivals. Please try again.');
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

    // Auto-populate location from selected festival
    if (name === 'parentFestivalId') {
      const selectedFestival = festivals.find(f => f.id === value);
      if (selectedFestival) {
        setFormData(prev => ({
          ...prev,
          location: selectedFestival.location
        }));
      }
    }
  };

  const validateDates = () => {
    if (!formData.parentFestivalId) return true;

    const selectedFestival = festivals.find(f => f.id === formData.parentFestivalId);
    if (!selectedFestival) return false;

    const eventStart = new Date(formData.startDate);
    const eventEnd = new Date(formData.endDate);
    const festivalStart = new Date(selectedFestival.startDate);
    const festivalEnd = new Date(selectedFestival.endDate);

    if (eventStart < festivalStart || eventEnd > festivalEnd) {
      alert('Event dates must be within the festival period');
      return false;
    }

    if (eventStart >= eventEnd) {
      alert('End date must be after start date');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateDates()) return;

    try {
      setSubmitting(true);
      
      const response = await fetch('/api/vendors/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      const result = await response.json();
      alert(result.message || 'Event submitted for approval successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: '',
        endDate: '',
        parentFestivalId: '',
      });
      
      // Redirect to vendor dashboard
      router.push('/vendor/dashboard');
    } catch (error) {
      console.error('Error creating event:', error);
      alert(error instanceof Error ? error.message : 'Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateForInput = (dateString: string) => {
    return new Date(dateString).toISOString().slice(0, 16);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Event</h1>
        <p className="text-gray-600">Submit your event for admin approval</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Festival Selection */}
        <div>
          <label htmlFor="parentFestivalId" className="block text-sm font-medium text-gray-700 mb-2">
            Select Festival *
          </label>
          <select
            id="parentFestivalId"
            name="parentFestivalId"
            value={formData.parentFestivalId}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a festival...</option>
            {festivals.map((festival) => (
              <option key={festival.id} value={festival.id}>
                {festival.title} - {festival.location} ({new Date(festival.startDate).toLocaleDateString()} - {new Date(festival.endDate).toLocaleDateString()})
              </option>
            ))}
          </select>
          {festivals.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">No active festivals available</p>
          )}
        </div>

        {/* Event Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Event Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter event title"
          />
        </div>

        {/* Event Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe your event"
          />
        </div>

        {/* Location */}
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Event location"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              required
              min={formData.parentFestivalId ? formatDateForInput(festivals.find(f => f.id === formData.parentFestivalId)?.startDate || '') : ''}
              max={formData.parentFestivalId ? formatDateForInput(festivals.find(f => f.id === formData.parentFestivalId)?.endDate || '') : ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              required
              min={formData.startDate || (formData.parentFestivalId ? formatDateForInput(festivals.find(f => f.id === formData.parentFestivalId)?.startDate || '') : '')}
              max={formData.parentFestivalId ? formatDateForInput(festivals.find(f => f.id === formData.parentFestivalId)?.endDate || '') : ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Festival Date Info */}
        {formData.parentFestivalId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Festival Information</h3>
            {festivals.find(f => f.id === formData.parentFestivalId) && (
              <div className="text-sm text-blue-800">
                <p><strong>Festival:</strong> {festivals.find(f => f.id === formData.parentFestivalId)?.title}</p>
                <p><strong>Period:</strong> {new Date(festivals.find(f => f.id === formData.parentFestivalId)?.startDate || '').toLocaleDateString()} - {new Date(festivals.find(f => f.id === formData.parentFestivalId)?.endDate || '').toLocaleDateString()}</p>
                <p><strong>Location:</strong> {festivals.find(f => f.id === formData.parentFestivalId)?.location}</p>
                <p className="mt-2 text-xs">Your event dates must be within this festival period.</p>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push('/vendor/dashboard')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || festivals.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 