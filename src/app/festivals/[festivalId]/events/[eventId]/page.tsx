import { redirect } from 'next/navigation';

interface FestivalEventPageProps {
  params: { 
    festivalId: string; 
    eventId: string; 
  };
}

export default function FestivalEventPage({ params }: FestivalEventPageProps) {
  // Redirect to the unified event page
  // The EventLayout will handle detecting if it's a child event
  redirect(`/events/${params.eventId}`);
} 