// Subevent modal — Editorial Invitation Layout + FOMO layer
// Scope: ONLY this file. Do not change other routes/layouts.
// Folio Design System: Uses neumorphic styling, accent colors, and folio typography

import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import ModalChromeClient from "./ModalChromeClient";
import { CalendarDays, MapPin } from "lucide-react";

import RsvpControl from "@/components/events/RsvpControl";
import AddToCalendar from "@/components/events/AddToCalendar";
import { resolveFeaturedProducts } from "@/lib/events/fetchFeaturedProducts";

// Client components
import FomoBar from "./FomoBar";
import FeaturedCarousel from "./FeaturedCarousel";
import FeaturedPlaceholder from "./FeaturedPlaceholder";

export const runtime = "nodejs";

const toDate = (d: any) => (d ? new Date(d as any) : null);

export default async function SubeventInvitationPage({
  params,
}: {
  params: { festivalId: string; eventId: string };
}) {
  const { eventId } = params;

  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      startDate: true,
      endDate: true,
      location: true,
      description: true,
      isPublic: true,
      capacity: true,
      linkedProducts: true,
      parentFestival: { select: { id: true, title: true } },
      _count: { select: { rsvps: true } },
    },
  });

  if (!event) return notFound();

  const startAt = toDate(event.startDate);
  const endAt = toDate(event.endDate);
  const inviteCopy = event.isPublic ? "Please join us at:" : "You are invited to:";
  const rsvpCount = event._count?.rsvps ?? 0;

  // Resolve featured products from linkedProducts
  const featuredProducts = await resolveFeaturedProducts(event.linkedProducts);
  const hasFeatured = featuredProducts.length > 0;

  // Map to expected shape for FeaturedCarousel
  const featured = featuredProducts.map(product => {
    let slug = null;
    if (product.url) {
      try {
        slug = new URL(product.url).pathname.split('/').pop() || null;
      } catch {
        // Invalid URL, use null slug
      }
    }
    
    return {
      id: product.id,
      title: product.title || null,
      imageUrl: product.imageUrl || null,
      brand: product.brand || null,
      slug,
    };
  });

  let fomoLine: string | null = null;
  if (event.capacity && event.capacity <= 100) fomoLine = "Spots are limited.";
  else if (event.parentFestival?.title) fomoLine = `Join top designers attending ${event.parentFestival.title}.`;

  return (
    <ModalChromeClient>
      <div className="relative min-h-[80svh] w-full text-white">
        {/* Background hero scoped to the window */}
        <div className="absolute inset-0 -z-10">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title ?? "Event hero"}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="h-full w-full bg-neutral-800" />
          )}
          <div className="absolute inset-0 bg-black/40" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        <div className="mx-auto w-full max-w-[960px] px-5 sm:px-6 md:px-8">
          {/* Hero copy - Folio Design System typography */}
          <div className="pt-12 md:pt-16">
            <p className="folio-meta text-white/90 tracking-wide">{inviteCopy}</p>
            <h1 className="mt-2 folio-h1 text-white leading-[var(--lh-h1)]">
              {event.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 folio-body text-white/95">
              {startAt ? (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--accent)]" />
                  {startAt.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  {startAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {endAt
                    ? ` - ${endAt.toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : ""}
                </span>
              ) : null}
              {event.location ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--accent)]" />
                  {event.location}
                </span>
              ) : null}
            </div>

            {/* CTAs */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <RsvpControl eventId={event.id} />
              <AddToCalendar
                event={{
                  id: event.id,
                  title: event.title,
                  startDate: startAt as any,
                  endDate: endAt as any,
                  location: event.location ?? undefined,
                } as any}
              />
            </div>

            {/* FOMO */}
            <FomoBar
              rsvpCount={rsvpCount}
              capacity={typeof event.capacity === "number" ? event.capacity : null}
              startAtISO={startAt ? startAt.toISOString() : null}
            />
            {fomoLine ? <p className="mt-2 folio-meta text-white/90">{fomoLine}</p> : null}
          </div>

          {/* Featured products */}
          <div className="mt-10 md:mt-12">
            <h3 className="folio-h3 text-white tracking-tight mb-3">
              See these at the event
            </h3>
            {hasFeatured ? (
              <FeaturedCarousel 
                products={featured} 
                eventId={event.parentFestival?.id}
                subeventId={eventId}
              />
            ) : (
              <FeaturedPlaceholder />
            )}
          </div>

          {/* About / Festival - Folio Design System typography */}
          <div className="mt-10 pb-10 md:pb-14">
            {event.description ? (
              <div className="max-w-none">
                <h3 className="folio-h3 text-white mb-3">About this event</h3>
                <p className="folio-body text-white/95">{event.description}</p>
              </div>
            ) : null}

            {event.parentFestival ? (
              <div className="mt-6 folio-meta text-white/90">
                Part of{" "}
                <Link
                  href={`/festivals/${event.parentFestival.id}`}
                  className="underline text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  {event.parentFestival.title}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ModalChromeClient>
  );
}
