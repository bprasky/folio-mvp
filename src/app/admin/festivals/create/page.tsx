'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FaCalendarAlt, FaMapMarkerAlt, FaGlobe, FaLock, FaCheck, FaExclamationTriangle } from 'react-icons/fa';

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
  show: boolean;
}

export default function CreateFestivalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage>({ type: 'success', message: '', show: false });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    isPublic: true,
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Redirect if not admin
  if (status === 'loading') {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'admin') {
    router.push('/auth/signin');
    return null;
  }

  const showToast = (type: ToastMessage['type'], message: string) => {
    setToast({ type, message, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    
    if (!formData.title.trim()) errors.title = 'Festival title is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.startDate) errors.startDate = 'Start date is required';
    if (!formData.endDate) errors.endDate = 'End date is required';
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        errors.endDate = 'End date must be after start date';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('error', 'Please fix the form errors before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          location: formData.location,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isPublic: formData.isPublic,
          type: 'festival',
          isFestival: true,
          isApproved: true, // Admin-created festivals are auto-approved
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create festival');
      }

      const result = await response.json();
      showToast('success', 'Festival created successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        location: '',
        startDate: '',
        endDate: '',
        isPublic: true,
      });
      
      // Redirect to festivals management page after a short delay
      setTimeout(() => {
        router.push('/admin/festivals');
      }, 2000);

    } catch (error) {
      console.error('Error creating festival:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to create festival');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Toast Messages */}
      {toast.show && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
          toast.type === 'success' ? 'bg-green-50 border border-green-200' : 
          toast.type === 'error' ? 'bg-red-50 border border-red-200' : 
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center">
            <div className={`flex-shrink-0 mr-3 ${
              toast.type === 'success' ? 'text-green-600' : 
              toast.type === 'error' ? 'text-red-600' : 
              'text-blue-600'
            }`}>
              {toast.type === 'success' ? <FaCheck /> : <FaExclamationTriangle />}
            </div>
            <div className={`text-sm font-medium ${
              toast.type === 'success' ? 'text-green-800' : 
              toast.type === 'error' ? 'text-red-800' : 
              'text-blue-800'
            }`}>
              {toast.message}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Festival</h1>
        <p className="text-gray-600">Create a design festival that vendors can submit events to</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Festival Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Festival Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., NYCxDesign 2025"
            disabled={isSubmitting}
          />
          {formErrors.title && (
            <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Describe the festival, its themes, and what vendors can expect..."
            disabled={isSubmitting}
          />
          {formErrors.description && (
            <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FaMapMarkerAlt className="inline mr-1" />
            Location *
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              formErrors.location ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., New York City, NY"
            disabled={isSubmitting}
          />
          {formErrors.location && (
            <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaCalendarAlt className="inline mr-1" />
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.startDate ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            />
            {formErrors.startDate && (
              <p className="mt-1 text-sm text-red-600">{formErrors.startDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaCalendarAlt className="inline mr-1" />
              End Date *
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.endDate ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isSubmitting}
            />
            {formErrors.endDate && (
              <p className="mt-1 text-sm text-red-600">{formErrors.endDate}</p>
            )}
          </div>
        </div>

        {/* Public/Private Toggle */}
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleInputChange}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={isSubmitting}
            />
            <span className="text-sm font-medium text-gray-700">
              {formData.isPublic ? (
                <><FaGlobe className="inline mr-1" /> Public Festival</>
              ) : (
                <><FaLock className="inline mr-1" /> Private Festival</>
              )}
            </span>
          </label>
          <p className="mt-1 text-sm text-gray-500">
            {formData.isPublic 
              ? "This festival will be visible to all vendors and can accept submissions"
              : "This festival will be private and only visible to selected vendors"
            }
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Festival...' : 'Create Festival'}
          </button>
        </div>
      </form>
    </div>
  );
} 