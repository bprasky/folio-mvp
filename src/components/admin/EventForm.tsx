'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaSave, FaTrash, FaCalendarAlt, FaMapMarkerAlt, FaImage, FaTag } from 'react-icons/fa';
import toast from 'react-hot-toast';
import FeaturedProductsPicker from './FeaturedProductsPicker';

// Zod schema for form validation
const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startsAt: z.string().min(1, "Start date is required"),
  endsAt: z.string().min(1, "End date is required"),
  city: z.string().optional(),
  venue: z.string().optional(),
  festivalId: z.string().optional(),
  eventTypes: z.array(z.string()).min(1, "At least one event type is required"),
  heroImageUrl: z.string().url().optional().or(z.literal('')),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  linkedProducts: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof eventFormSchema>;

type UIProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  vendorName?: string | null;
};

interface EventFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  festivals?: Array<{ id: string; title: string }>;
  eventTypeOptions: string[];
}

export default function EventForm({ 
  mode, 
  defaultValues, 
  onSubmit, 
  onDelete,
  festivals = [],
  eventTypeOptions
}: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<UIProduct[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      startsAt: '',
      endsAt: '',
      city: '',
      venue: '',
      festivalId: '',
      eventTypes: [],
      heroImageUrl: '',
      coverImageUrl: '',
      ...defaultValues,
    },
  });

  const watchedEventTypes = watch('eventTypes');

  // Load existing featured products on mount
  useEffect(() => {
    const loadFeaturedProducts = async () => {
      if (mode === "edit" && defaultValues?.linkedProducts?.length) {
        try {
          const response = await fetch(`/api/products/bulk?ids=${defaultValues.linkedProducts.join(',')}`);
          if (response.ok) {
            const products = await response.json();
            setFeaturedProducts(products);
          }
        } catch (error) {
          console.error('Failed to load featured products:', error);
        }
      }
    };

    loadFeaturedProducts();
  }, [mode, defaultValues?.linkedProducts]);

  const handleFormSubmit = async (values: FormValues) => {
    console.log('🎯 FORM SUBMIT CALLED - handleFormSubmit started');
    setIsSubmitting(true);
    try {
      // Include featured products in the submission
      const valuesWithProducts = {
        ...values,
        linkedProducts: featuredProducts.map(p => p.id),
      };
      
      // For debugging: log the values being sent
      console.log('📤 Submitting form values:', valuesWithProducts);
      console.log('📤 About to call onSubmit with:', valuesWithProducts);
      
      await onSubmit(valuesWithProducts);
      toast.success(mode === "edit" ? "Event updated successfully!" : "Event created successfully!");
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete();
      toast.success("Event deleted successfully!");
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const toggleEventType = (eventType: string) => {
    const currentTypes = watchedEventTypes || [];
    const newTypes = currentTypes.includes(eventType)
      ? currentTypes.filter(type => type !== eventType)
      : [...currentTypes, eventType];
    setValue('eventTypes', newTypes);
  };

  const allEventTypes = eventTypeOptions;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {mode === "edit" ? "Edit Event" : "Create New Event"}
        </h1>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Event Title *
            </label>
            <input
              {...register('title')}
              type="text"
              id="title"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter event title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter event description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startsAt" className="block text-sm font-medium text-gray-700 mb-2">
                <FaCalendarAlt className="inline mr-2" />
                Start Date & Time
              </label>
              <input
                {...register('startsAt')}
                type="datetime-local"
                id="startsAt"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.startsAt ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.startsAt && (
                <p className="mt-1 text-sm text-red-600">{errors.startsAt.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="endsAt" className="block text-sm font-medium text-gray-700 mb-2">
                <FaCalendarAlt className="inline mr-2" />
                End Date & Time
              </label>
              <input
                {...register('endsAt')}
                type="datetime-local"
                id="endsAt"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.endsAt ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.endsAt && (
                <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                <FaMapMarkerAlt className="inline mr-2" />
                City
              </label>
              <input
                {...register('city')}
                type="text"
                id="city"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter city"
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
                <FaMapMarkerAlt className="inline mr-2" />
                Venue
              </label>
              <input
                {...register('venue')}
                type="text"
                id="venue"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.venue ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter venue"
              />
              {errors.venue && (
                <p className="mt-1 text-sm text-red-600">{errors.venue.message}</p>
              )}
            </div>
          </div>

          {/* Festival Selection */}
          <div>
            <label htmlFor="festivalId" className="block text-sm font-medium text-gray-700 mb-2">
              Parent Festival (Optional)
            </label>
            <select
              {...register('festivalId')}
              id="festivalId"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                errors.festivalId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">No parent festival</option>
              {festivals.map((festival) => (
                <option key={festival.id} value={festival.id}>
                  {festival.title}
                </option>
              ))}
            </select>
            {errors.festivalId && (
              <p className="mt-1 text-sm text-red-600">{errors.festivalId.message}</p>
            )}
          </div>

          {/* Event Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FaTag className="inline mr-2" />
              Event Types *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {allEventTypes.map((eventType) => (
                <label key={eventType} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={watchedEventTypes?.includes(eventType) || false}
                    onChange={() => toggleEventType(eventType)}
                    className="rounded border-gray-300 text-folio-accent focus:ring-folio-accent"
                  />
                  <span className="text-sm text-gray-700">{eventType.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
            {errors.eventTypes && (
              <p className="mt-1 text-sm text-red-600">{errors.eventTypes.message}</p>
            )}
            {(!watchedEventTypes || watchedEventTypes.length === 0) && (
              <p className="mt-1 text-xs text-yellow-700">This event has no type. Select at least one to save.</p>
            )}
          </div>

          {/* Image URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="heroImageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                <FaImage className="inline mr-2" />
                Hero Image URL
              </label>
              <input
                {...register('heroImageUrl')}
                type="url"
                id="heroImageUrl"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.heroImageUrl ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://example.com/image.jpg"
              />
              {errors.heroImageUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.heroImageUrl.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                <FaImage className="inline mr-2" />
                Cover Image URL
              </label>
              <input
                {...register('coverImageUrl')}
                type="url"
                id="coverImageUrl"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.coverImageUrl ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="https://example.com/cover.jpg"
              />
              {errors.coverImageUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.coverImageUrl.message}</p>
              )}
            </div>
          </div>

          {/* Featured Products */}
          <FeaturedProductsPicker
            selectedProducts={featuredProducts}
            onProductsChange={setFeaturedProducts}
          />

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center px-6 py-2 bg-folio-accent text-white rounded-md hover:bg-folio-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSave className="mr-2" />
                {isSubmitting ? 'Saving...' : mode === "edit" ? "Update Event" : "Create Event"}
              </button>

              {mode === "edit" && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaTrash className="mr-2" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this event? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 