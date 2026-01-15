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
  // New location fields
  address1: z.string().optional(),
  address2: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  inheritFestivalLocation: z.string().optional(),
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
  event?: any; // The current event data including location fields
  festival?: any; // The parent festival data if event belongs to one
}

export default function EventForm({ 
  mode, 
  defaultValues, 
  onSubmit, 
  onDelete,
  festivals = [],
  eventTypeOptions,
  event,
  festival
}: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<UIProduct[]>([]);

  // Location inheritance logic
  const hasOwnLoc = Boolean(event?.city || (event?.latitude && event?.longitude));
  const canInherit = Boolean(festival?.city || (festival?.latitude && festival?.longitude));
  const [inheritFestivalLocation, setInheritFestivalLocation] = useState(
    !hasOwnLoc && Boolean(event?.parentFestivalId) && canInherit
  );

  const effective = {
    city: inheritFestivalLocation && festival ? (festival.city ?? "") : (event?.city ?? ""),
    state: inheritFestivalLocation && festival ? (festival.state ?? "") : (event?.state ?? ""),
    country: inheritFestivalLocation && festival ? (festival.country ?? "") : (event?.country ?? ""),
    latitude: inheritFestivalLocation && festival ? (festival.latitude?.toString() ?? "") : (event?.latitude?.toString() ?? ""),
    longitude: inheritFestivalLocation && festival ? (festival.longitude?.toString() ?? "") : (event?.longitude?.toString() ?? ""),
    address1: inheritFestivalLocation ? "" : (event?.address1 ?? ""),
    address2: inheritFestivalLocation ? "" : (event?.address2 ?? ""),
    postalCode: inheritFestivalLocation ? "" : (event?.postalCode ?? ""),
  };

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
      venue: '',
      festivalId: '',
      eventTypes: [],
      heroImageUrl: '',
      coverImageUrl: '',
      ...defaultValues,
      ...effective,
    },
  });

  const watchedEventTypes = watch('eventTypes');
  
  // Check if this is a festival (festivals can't have parent festivals or featured products)
  const isFestival = watchedEventTypes?.includes('FESTIVAL');

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
      // Check if this is a festival
      const isFestival = values.eventTypes?.includes('FESTIVAL');
      
      // Prepare submission data
      const valuesWithProducts = {
        ...values,
        // Festivals don't have featured products or parent festivals
        linkedProducts: isFestival ? [] : featuredProducts.map(p => p.id),
        festivalId: isFestival ? '' : values.festivalId, // Clear parent festival for festivals
      };
      
      // For debugging: log the values being sent
      console.log('📤 Submitting form values:', JSON.stringify(valuesWithProducts, null, 2));
      console.log('📤 Form image fields:', {
        heroImageUrl: valuesWithProducts.heroImageUrl,
        coverImageUrl: valuesWithProducts.coverImageUrl,
        heroType: typeof valuesWithProducts.heroImageUrl,
        coverType: typeof valuesWithProducts.coverImageUrl,
      });
      console.log('📤 Is Festival:', isFestival);
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
      <div className="bg-[var(--bg-base)] rounded-lg shadow-sm border border-folio-border p-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          {mode === "edit" ? "Edit Event" : "Create New Event"}
        </h1>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Event Title *
            </label>
            <input
              {...register('title')}
              type="text"
              id="title"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                errors.title ? 'border-red-500' : 'border-[var(--ridge-outer)]'
              }`}
              placeholder="Enter event title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                errors.description ? 'border-red-500' : 'border-[var(--ridge-outer)]'
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
              <label htmlFor="startsAt" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <FaCalendarAlt className="inline mr-2" />
                Start Date & Time
              </label>
              <input
                {...register('startsAt')}
                type="datetime-local"
                id="startsAt"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.startsAt ? 'border-red-500' : 'border-[var(--ridge-outer)]'
                }`}
              />
              {errors.startsAt && (
                <p className="mt-1 text-sm text-red-600">{errors.startsAt.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="endsAt" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <FaCalendarAlt className="inline mr-2" />
                End Date & Time
              </label>
              <input
                {...register('endsAt')}
                type="datetime-local"
                id="endsAt"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.endsAt ? 'border-red-500' : 'border-[var(--ridge-outer)]'
                }`}
              />
              {errors.endsAt && (
                <p className="mt-1 text-sm text-red-600">{errors.endsAt.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <section className="rounded-2xl border border-[var(--ridge-outer)] bg-[var(--bg-base)] p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-[var(--text-primary)]">Location</h3>
              {event?.parentFestivalId && canInherit && (
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={inheritFestivalLocation}
                    onChange={(e) => setInheritFestivalLocation(e.target.checked)}
                  />
                  Use festival location
                </label>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input 
                {...register('address1')}
                name="address1" 
                placeholder="Address line 1" 
                defaultValue={effective.address1} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <input 
                {...register('address2')}
                name="address2" 
                placeholder="Address line 2" 
                defaultValue={effective.address2} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <input 
                {...register('city')}
                name="city" 
                placeholder="City" 
                defaultValue={effective.city} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <input 
                {...register('state')}
                name="state" 
                placeholder="State/Region" 
                defaultValue={effective.state} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <input 
                {...register('postalCode')}
                name="postalCode" 
                placeholder="Postal code" 
                defaultValue={effective.postalCode} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <input 
                {...register('country')}
                name="country" 
                placeholder="Country" 
                defaultValue={effective.country} 
                disabled={inheritFestivalLocation} 
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                }`} 
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  {...register('latitude')}
                  name="latitude" 
                  placeholder="Latitude" 
                  defaultValue={effective.latitude} 
                  disabled={inheritFestivalLocation} 
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                    inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                  }`} 
                />
                <input 
                  {...register('longitude')}
                  name="longitude" 
                  placeholder="Longitude" 
                  defaultValue={effective.longitude} 
                  disabled={inheritFestivalLocation} 
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                    inheritFestivalLocation ? 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)]' : 'border-[var(--ridge-outer)]'
                  }`} 
                />
              </div>
            </div>

            {/* Persist the toggle so the action knows whether to null out the event location */}
            <input type="hidden" {...register('inheritFestivalLocation')} value={inheritFestivalLocation ? "1" : "0"} />
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Tip: If "Use festival location" is on, the event won't store its own city/coords — it inherits from the festival.
            </p>
          </section>

          {/* Festival Selection - Only show for non-festivals */}
          {!isFestival && (
            <div>
              <label htmlFor="festivalId" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Parent Festival (Optional)
              </label>
              <select
                {...register('festivalId')}
                id="festivalId"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.festivalId ? 'border-red-500' : 'border-[var(--ridge-outer)]'
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
          )}
          
          {isFestival && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Festival Mode:</strong> This is a top-level festival. It cannot have a parent festival.
              </p>
            </div>
          )}

          {/* Event Types */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
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
                    className="rounded border-[var(--ridge-outer)] text-folio-accent focus:ring-folio-accent"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{eventType.replace(/_/g, ' ')}</span>
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
              <label htmlFor="heroImageUrl" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <FaImage className="inline mr-2" />
                Hero Image URL
              </label>
              <input
                {...register('heroImageUrl')}
                type="url"
                id="heroImageUrl"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.heroImageUrl ? 'border-red-500' : 'border-[var(--ridge-outer)]'
                }`}
                placeholder="https://example.com/image.jpg"
              />
              {errors.heroImageUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.heroImageUrl.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="coverImageUrl" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                <FaImage className="inline mr-2" />
                Cover Image URL
              </label>
              <input
                {...register('coverImageUrl')}
                type="url"
                id="coverImageUrl"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent ${
                  errors.coverImageUrl ? 'border-red-500' : 'border-[var(--ridge-outer)]'
                }`}
                placeholder="https://example.com/cover.jpg"
              />
              {errors.coverImageUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.coverImageUrl.message}</p>
              )}
            </div>
          </div>

          {/* Featured Products - Only show for non-festivals (events and subevents) */}
          {!isFestival && (
            <>
              <div className="border-t border-[var(--ridge-outer)] pt-6">
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Featured Products</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Add products to feature at this event. These will be displayed prominently to attendees.
                </p>
              </div>
              <FeaturedProductsPicker
                selectedProducts={featuredProducts}
                onProductsChange={setFeaturedProducts}
              />
            </>
          )}
          
          {isFestival && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Festivals don't have featured products. Featured products can be added to individual events and subevents within this festival.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-[var(--ridge-outer)]">
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
            <div className="bg-[var(--bg-base)] rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Confirm Delete</h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete this event? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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