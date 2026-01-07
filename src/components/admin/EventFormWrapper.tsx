'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import EventForm from './EventForm';
import { EventFormValues, mapFormValuesToApiData } from '@/lib/mapEventToForm';

interface EventFormWrapperProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<EventFormValues>;
  editId?: string;
  festivals: Array<{ id: string; title: string }>;
  parentFestivalId?: string | null;
}

export default function EventFormWrapper({
  mode,
  defaultValues = {},
  editId,
  festivals,
  parentFestivalId,
}: EventFormWrapperProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (values: EventFormValues) => {
    try {
      setIsSubmitting(true);
      const apiData = mapFormValuesToApiData(values);

      if (mode === 'create') {
        // Create new event
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiData),
        });

        if (!response.ok) {
          throw new Error('Failed to create event');
        }

        const createdEvent = await response.json();
        router.push(`/events/${createdEvent.id}?adminToast=created`);
      } else {
        // Update existing event
        if (!editId) return;

        const response = await fetch(`/api/events/${editId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiData),
        });

        if (!response.ok) {
          throw new Error('Failed to update event');
        }

        router.push(`/events/${editId}?adminToast=updated`);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/events/${editId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      // Redirect to events list or parent festival if applicable
      if (parentFestivalId) {
        router.push(`/events/${parentFestivalId}?adminToast=deleted`);
      } else {
        router.push('/events?adminToast=deleted');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('An error occurred while deleting the event. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <EventForm
      mode={mode}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      onDelete={mode === 'edit' ? handleDelete : undefined}
      festivals={festivals}
    />
  );
} 