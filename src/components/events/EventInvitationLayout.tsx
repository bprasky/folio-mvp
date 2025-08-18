import EventBackdrop from "./EventBackdrop";
import InvitationHeader from "./InvitationHeader";
import GlassTile from "@/components/ui/GlassTile";
import FeaturedProducts from "./FeaturedProducts";
import BreakoutPanel from "./BreakoutPanel";
import Schedule from "./Schedule";
import LiveActivity from "./LiveActivity";
import UserRecap from "./UserRecap";
import FestivalContext from "./FestivalContext";

// This component expects you to pass already-fetched event data
type Props = {
  event: {
    id: string;
    title: string;
    heroImageUrl?: string | null;
    startAt?: Date | null;
    endAt?: Date | null;
    venue?: string | null;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    vendor?: { id: string; name?: string | null; slug?: string | null } | null;
    festival?: { id: string; title: string; slug?: string | null } | null;
  };
  // Render props for interactive bits you already have
  rsvpControl?: React.ReactNode;
  addToCalendarControl?: React.ReactNode;
};

export default function EventInvitationLayout({ event, rsvpControl, addToCalendarControl }: Props) {
  const locationLine = [event.venue, event.city].filter(Boolean).join(", ");

  return (
    <div className="relative min-h-[100svh]">
      <EventBackdrop src={event.heroImageUrl ?? null} alt={event.title} />

      {/* Top guard so content clears your global nav */}
      <div className="pt-6 lg:pt-8" />

      {/* Optional festival breadcrumb/context (tile style) */}
      {event.festival ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FestivalContext festival={event.festival} eventTitle={event.title} />
        </div>
      ) : null}

      {/* Mosaic grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-12 gap-6">
          {/* Row 1 */}
          <div className="col-span-12 lg:col-span-8">
            <InvitationHeader
              title={event.title}
              vendorName={event.vendor?.name ?? null}
              startAt={event.startAt ?? null}
              endAt={event.endAt ?? null}
              location={locationLine || null}
              inviteCopy="invited"
              festival={event.festival ?? null}
              onRsvp={rsvpControl}
              onAddToCal={addToCalendarControl}
              hostLinkHref={
                event.vendor?.slug
                  ? `/vendors/${event.vendor.slug}`
                  : event.vendor?.id
                  ? `/vendors/${event.vendor.id}`
                  : null
              }
            />
          </div>

          <div className="col-span-12 lg:col-span-4">
            <GlassTile className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3">Quick actions</h3>
              {/* Place "Send to team", "Follow vendor", "Share" here using your existing buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* SLOT your existing buttons/components */}
                {/* <SendToTeamButton eventId={event.id} /> */}
                {/* <FollowVendorButton vendorId={event.vendor?.id} /> */}
                {/* <ShareButton /> */}
              </div>
            </GlassTile>
          </div>

          {/* Row 2: Featured & Breakout */}
          <div className="col-span-12">
            <GlassTile className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-4">See these at the event</h3>
              <FeaturedProducts eventId={event.id} />
            </GlassTile>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <GlassTile className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-4">Schedule</h3>
              <Schedule eventId={event.id} />
            </GlassTile>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <GlassTile className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-4">Trending at this event</h3>
              <BreakoutPanel eventId={event.id} />
            </GlassTile>
          </div>

          {/* Row 3: Live / Recap */}
          <div className="col-span-12 lg:col-span-6">
            <GlassTile className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base md:text-lg font-semibold">Live activity</h3>
                {/* You can mount your toggle here if needed */}
              </div>
              <div className="mt-3">
                <LiveActivity eventId={event.id} />
              </div>
            </GlassTile>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <GlassTile className="p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-4">Your saves from this event</h3>
              <UserRecap eventId={event.id} />
            </GlassTile>
          </div>
        </div>
      </div>
    </div>
  );
}
