"use client";

import { useState } from "react";
import Image from "next/image";
import ModalChromeClient from "@/components/modal/ModalChromeClient";
import EventModalBodyClient from "@/components/events/modal/EventModalBodyClient";

type LocalEvent = {
  id: string;
  title: string;
  imageUrl?: string | null;
  heroImageUrl?: string | null;
  coverImageUrl?: string | null;
  startsAt?: string | null;
  startDate?: string | null;
  href?: string;
  city?: string | null;
};

type LocalEventsProps = {
  events: LocalEvent[];
};

export default function LocalEvents({ events }: LocalEventsProps) {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleEventClick = async (eventId: string) => {
    setLoading(true);
    setActiveEventId(eventId);
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const result = await response.json();
        setModalData(result);
      } else {
        console.error("Error fetching event:", await response.text());
        setActiveEventId(null);
      }
    } catch (error) {
      console.error("Error fetching event for modal:", error);
      setActiveEventId(null);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = (e: LocalEvent) => {
    return e.heroImageUrl || e.coverImageUrl || e.imageUrl || "/images/event-placeholder.jpg";
  };

  return (
    <>
      <section className="mt-10">
        <div className="mx-[calc(50%-50vw)] px-6 md:px-12">
          <h2 className="font-serif text-2xl md:text-3xl mb-4 text-folio-text-primary">Events near you</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => handleEventClick(e.id)}
                className="text-left group"
              >
                <div className="relative rounded-[20px] overflow-hidden aspect-[16/10] shadow-sm hover:shadow-md transition-shadow">
                  <Image
                    src={pickImage(e)}
                    alt={e.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  <div className="absolute left-5 bottom-5 right-5 text-white">
                    <h3 className="font-serif text-xl md:text-2xl leading-tight">{e.title}</h3>
                    <p className="text-xs opacity-85 mt-1">
                      {e.city ? `${e.city} • ` : ""}
                      {e.startsAt || e.startDate
                        ? new Date(e.startsAt || e.startDate || "").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeEventId && modalData && (
        <ModalChromeClient onClose={() => {
          setActiveEventId(null);
          setModalData(null);
        }}>
          <EventModalBodyClient data={modalData.data} featuredProducts={modalData.featuredProducts} />
        </ModalChromeClient>
      )}

      {loading && activeEventId && (
        <ModalChromeClient onClose={() => {
          setActiveEventId(null);
          setLoading(false);
        }}>
          <div className="flex items-center justify-center min-h-[400px] text-white">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading event...</p>
            </div>
          </div>
        </ModalChromeClient>
      )}
    </>
  );
}

