import Link from 'next/link';

interface SmartInvitesCardProps {
  vendorId: string;
  eventId?: string;
}

export default function SmartInvitesCard({ eventId }: SmartInvitesCardProps) {
  return (
    <section className="rounded-lg p-6 space-y-2">
      <h3 className="text-lg font-semibold">Legacy smart invites retired</h3>
      <p>Use the event invitation workflow to invite guests. This card no longer sends invitations.</p>
      <Link href={eventId ? `/events/${encodeURIComponent(eventId)}` : '/events'} className="underline">Open events</Link>
    </section>
  );
}
