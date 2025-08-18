'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

// Validation schema
const eventFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  location: z.string().min(1, 'Location is required'),
  isVirtual: z.boolean(),
  eventTypes: z.array(z.enum(['FESTIVAL', 'CONFERENCE', 'WORKSHOP', 'EXHIBITION', 'PERFORMANCE', 'MEETUP', 'OTHER'])).min(1, 'At least one event type is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isPublic: z.boolean(),
  isApproved: z.boolean(),
  parentFestivalId: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventAdminFormProps {
  initialEvent: any;
  availableFestivals: Array<{ id: string; title: string }>;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'EXHIBITION', label: 'Exhibition' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'MEETUP', label: 'Meetup' },
  { value: 'OTHER', label: 'Other' },
];

export default function EventAdminForm({ initialEvent, availableFestivals }: EventAdminFormProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: initialEvent.title,
      description: initialEvent.description,
      startDate: initialEvent.startDate ? new Date(initialEvent.startDate).toISOString().slice(0, 16) : '',
      endDate: initialEvent.endDate ? new Date(initialEvent.endDate).toISOString().slice(0, 16) : '',
      location: initialEvent.location,
      isVirtual: initialEvent.isVirtual,
      eventTypes: initialEvent.eventTypes || [],
      imageUrl: initialEvent.imageUrl || '',
      isPublic: initialEvent.isPublic,
      isApproved: initialEvent.isApproved,
      parentFestivalId: initialEvent.parentFestivalId || '',
    },
  });

  const watchedEventTypes = watch('eventTypes');

  const onSubmit = async (data: EventFormData) => {
    try {
      const response = await fetch(`/api/events/${initialEvent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      toast.success('Event updated successfully!');
      router.push('/events');
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update event');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/events/${initialEvent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast.error(error.message);
        } else {
          throw new Error(error.error || 'Failed to delete event');
        }
        return;
      }

      toast.success('Event deleted successfully!');
      router.push('/events');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete event');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              {...register('title')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <input
              type="text"
              {...register('location')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              {...register('startDate')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              {...register('endDate')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
            )}
          </div>
        </div>

        {/* Event Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Types *
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EVENT_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  value={option.value}
                  {...register('eventTypes')}
                  className="mr-2"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.eventTypes && (
            <p className="mt-1 text-sm text-red-600">{errors.eventTypes.message}</p>
          )}
        </div>

        {/* Festival Selection */}
        {availableFestivals.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parent Festival (Optional)
            </label>
            <select
              {...register('parentFestivalId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No parent festival</option>
              {availableFestivals.map((festival) => (
                <option key={festival.id} value={festival.id}>
                  {festival.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Image URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL
          </label>
          <input
            type="url"
            {...register('imageUrl')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com/image.jpg"
          />
          {errors.imageUrl && (
            <p className="mt-1 text-sm text-red-600">{errors.imageUrl.message}</p>
          )}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('isVirtual')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Virtual Event</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('isPublic')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Public Event</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('isApproved')}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Approved</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            
            <button
              type="button"
              onClick={() => router.push('/events')}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete Event
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete Event
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "{initialEvent.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 