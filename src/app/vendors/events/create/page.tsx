'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaCheck, FaExclamationCircle } from 'react-icons/fa';

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

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
  show: boolean;
}

export default function CreateEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [associateWithFestival, setAssociateWithFestival] = useState(false);
  const [toast, setToast] = useState<ToastMessage>({ type: 'success', message: '', show: false });
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

    if ((session?.user as any)?.role !== 'vendor') {
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
      showToast('error', 'Failed to load festivals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 5000);
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

  const handleFestivalToggle = (value: boolean) => {
    setAssociateWithFestival(value);
    if (!value) {
      setFormData(prev => ({
        ...prev,
        parentFestivalId: '',
        location: ''
      }));
    }
  };

  const validateDates = () => {
    const eventStart = new Date(formData.startDate);
    const eventEnd = new Date(formData.endDate);

    if (eventStart >= eventEnd) {
      showToast('error', 'End date must be after start date');
      return false;
    }

    // If associated with festival, validate dates are within festival bounds
    if (associateWithFestival && formData.parentFestivalId) {
      const selectedFestival = festivals.find(f => f.id === formData.parentFestivalId);
      if (!selectedFestival) return false;

      const festivalStart = new Date(selectedFestival.startDate);
      const festivalEnd = new Date(selectedFestival.endDate);

      if (eventStart < festivalStart || eventEnd > festivalEnd) {
        showToast('error', `Event dates must be within the festival period (${new Date(selectedFestival.startDate).toLocaleDateString()} - ${new Date(selectedFestival.endDate).toLocaleDateString()})`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateDates()) return;

    try {
      setSubmitting(true);
      
      const submitData = {
        ...formData,
        parentFestivalId: associateWithFestival ? formData.parentFestivalId : null
      };
      
      const response = await fetch('/api/vendors/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      const result = await response.json();
      
      if (associateWithFestival && formData.parentFestivalId) {
        const selectedFestival = festivals.find(f => f.id === formData.parentFestivalId);
        showToast('success', `Your event has been submitted for approval to ${selectedFestival?.title || 'the festival organizer'}.`);
      } else {
        showToast('success', 'Event submitted successfully!');
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: '',
        endDate: '',
        parentFestivalId: '',
      });
      setAssociateWithFestival(false);
      
      // Redirect to vendor dashboard after delay
      setTimeout(() => {
        router.push('/vendor/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error creating event:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to create event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFestival = festivals.find(f => f.id === formData.parentFestivalId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          toast.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {toast.type === 'success' && <FaCheck className="w-5 h-5 mr-2" />}
          {toast.type === 'error' && <FaExclamationCircle className="w-5 h-5 mr-2" />}
          {toast.type === 'info' && <FaExclamationCircle className="w-5 h-5 mr-2" />}
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Event</h1>
        <p className="text-gray-600">Create a standalone event or submit to a Design Festival</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Festival Association Toggle */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Festival Association</h3>
          <div className="space-y-4">
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="eventType"
                value="standalone"
                checked={!associateWithFestival}
                onChange={() => handleFestivalToggle(false)}
                className="mt-1 mr-3 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-900">No - Create Standalone Event</span>
                <p className="text-sm text-gray-500 mt-1">Your event will be live immediately and visible to all users</p>
              </div>
            </label>
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="eventType"
                value="festival"
                checked={associateWithFestival}
                onChange={() => handleFestivalToggle(true)}
                className="mt-1 mr-3 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-900">Yes - Submit to Design Festival</span>
                <p className="text-sm text-gray-500 mt-1">Submit your event to an active Design Festival (requires approval)</p>
              </div>
            </label>
          </div>
        </div>

        {/* Festival Selection - Only show if associating with festival */}
        {associateWithFestival && (
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <label htmlFor="parentFestivalId" className="block text-sm font-medium text-gray-700 mb-2">
              <FaUsers className="inline mr-2" />
              Select Design Festival *
            </label>
            <select
              id="parentFestivalId"
              name="parentFestivalId"
              value={formData.parentFestivalId}
              onChange={handleInputChange}
              required={!!associateWithFestival}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a festival...</option>
              {festivals.map((festival) => (
                <option key={festival.id} value={festival.id}>
                  {festival.title} ({new Date(festival.startDate).toLocaleDateString()} - {new Date(festival.endDate).toLocaleDateString()})
                </option>
              ))}
            </select>
            {festivals.length === 0 && (
              <p className="text-sm text-red-600 mt-2">No active festivals available for submissions</p>
            )}
            {selectedFestival && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                <div className="flex items-center mb-2">
                  <FaCalendarAlt className="text-blue-600 mr-2" />
                  <span className="font-medium text-gray-900">Summary</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>This event will be submitted to {selectedFestival.title} for approval.</strong>
                </p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><FaMapMarkerAlt className="inline mr-1" /> Location: {selectedFestival.location}</p>
                  <p><FaCalendarAlt className="inline mr-1" /> Festival Period: {new Date(selectedFestival.startDate).toLocaleDateString()} - {new Date(selectedFestival.endDate).toLocaleDateString()}</p>
                  <p className="text-blue-600 font-medium">• Event dates must fall within the festival period</p>
                  <p className="text-blue-600 font-medium">• Location will be auto-populated from festival</p>
                </div>
              </div>
            )}
          </div>
        )}

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
            placeholder="Describe your event..."
          />
        </div>

        {/* Event Location */}
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
            placeholder="Enter event location"
            disabled={!!(associateWithFestival && formData.parentFestivalId)}
          />
          {associateWithFestival && formData.parentFestivalId && (
            <p className="text-sm text-gray-500 mt-1">
              <FaMapMarkerAlt className="inline mr-1" />
              Location automatically set from selected festival
            </p>
          )}
        </div>

        {/* Event Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="datetime-local"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date *
            </label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting || (associateWithFestival && festivals.length === 0)}
            className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${
              submitting || (associateWithFestival && festivals.length === 0)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {submitting 
              ? 'Creating Event...' 
              : associateWithFestival 
                ? 'Submit for Approval' 
                : 'Create Event'
            }
          </button>
        </div>
      </form>
    </div>
  );
} 