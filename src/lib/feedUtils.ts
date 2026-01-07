import { UIEvent } from '../components/feed/EditorialFeed';

export function mapEventToFeedItem(event: any): UIEvent {
  return {
    id: event.id,
    slug: event.id,
    title: event.title || 'Untitled Event',
    city: event.city || event.location || 'TBD',
    venue: event.venue || event.location || 'TBD',
    eventTypes: event.eventTypes || ['OTHER'],
    heroImage: event.heroImage || event.imageUrl || event.coverImage,
    coverImage: event.coverImage || event.imageUrl || event.heroImage,
    startsAt: event.startDate || event.startsAt || new Date().toISOString(),
    endsAt: event.endDate || event.endsAt
  };
}

export function mapEventsToFeedItems(events: any[]): UIEvent[] {
  return events.map(mapEventToFeedItem);
} 