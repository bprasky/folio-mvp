export interface EventFormValues {
  title: string;
  slug: string;
  description: string;
  startsAt: string;
  endsAt: string;
  city: string;
  venue: string;
  festivalId: string;
  eventTypes: string[];
  heroImageUrl: string;
  coverImageUrl: string;
}

export interface ApiEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  parentFestivalId: string | null;
  eventTypes: string[];
  imageUrl: string | null;
}

export const EVENT_TYPES = [
  'PANEL',
  'PRODUCT_REVEAL',
  'HAPPY_HOUR',
  'LUNCH_AND_LEARN',
  'INSTALLATION',
  'EXHIBITION',
  'BOOTH',
  'PARTY',
  'MEAL',
  'TOUR',
  'AWARDS',
  'WORKSHOP',
  'KEYNOTE',
  'OTHER',
  'FESTIVAL',
] as const;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  PANEL: 'Panel Discussion',
  PRODUCT_REVEAL: 'Product Reveal',
  HAPPY_HOUR: 'Happy Hour',
  LUNCH_AND_LEARN: 'Lunch & Learn',
  INSTALLATION: 'Installation',
  EXHIBITION: 'Exhibition',
  BOOTH: 'Booth',
  PARTY: 'Party',
  MEAL: 'Meal',
  TOUR: 'Tour',
  AWARDS: 'Awards',
  WORKSHOP: 'Workshop',
  KEYNOTE: 'Keynote',
  OTHER: 'Other',
  FESTIVAL: 'Festival',
};

export function mapApiEventToFormValues(event: ApiEvent): EventFormValues {
  return {
    title: event.title,
    slug: event.id, // Using ID as slug since we don't have a slug field
    description: event.description,
    startsAt: event.startDate,
    endsAt: event.endDate,
    city: event.location,
    venue: '', // Not available in current API response
    festivalId: event.parentFestivalId || '',
    eventTypes: event.eventTypes,
    heroImageUrl: event.imageUrl || '',
    coverImageUrl: event.imageUrl || '',
  };
}

export function mapFormValuesToApiData(values: EventFormValues) {
  return {
    title: values.title,
    description: values.description,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    city: values.city,
    festivalId: values.festivalId || null,
    eventTypes: values.eventTypes,
    imageUrl: values.heroImageUrl || values.coverImageUrl || null,
  };
} 