"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import SafeImage from "@/components/SafeImage";
import { UserEventRecap } from "@/lib/events";
import Link from "next/link";

interface UserRecapProps {
  recaps?: UserEventRecap[];
  eventId?: string;
}

export default function UserRecap({ recaps: propRecaps, eventId }: UserRecapProps) {
  const { data: session } = useSession();
  const [recaps, setRecaps] = useState<UserEventRecap[] | null>(null);
  const [loading, setLoading] = useState(false);

  // If recaps are passed as props, use them; otherwise fetch by eventId
  useEffect(() => {
    if (propRecaps !== undefined) {
      setRecaps(propRecaps);
      return;
    }

    if (!eventId || !session?.user?.id) {
      setRecaps([]);
      return;
    }

    setLoading(true);
    fetch(`/api/events/${eventId}/user-recap`)
      .then(res => res.json())
      .then(data => {
        setRecaps(data.recaps || []);
      })
      .catch(error => {
        console.error("Error fetching user recap:", error);
        setRecaps([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [propRecaps, eventId, session?.user?.id]);

  // Loading state
  if (loading || recaps === null) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="rounded-xl bg-surface-canvas/60 backdrop-blur-md border border-folio-border-subtle shadow-sm">
              <div className="h-32 bg-surface-ground rounded-t-xl"></div>
              <div className="p-3">
                <div className="h-4 bg-surface-ground rounded mb-2"></div>
                <div className="h-3 bg-surface-ground rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state or no session
  if (!session?.user?.id || !recaps || recaps.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-folio-text-secondary">
          {!session?.user?.id ? "Sign in to see your saved products." : "No saved products from this event yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {recaps.map((recap) => (
        <div
          key={recap.id}
          className="bg-surface-canvas/60 backdrop-blur-md rounded-xl border border-folio-border-subtle overflow-hidden hover:shadow-lg transition-shadow"
        >
          {/* Product Image */}
          <div className="relative h-32 bg-surface-ground">
            <SafeImage
              src={recap.imageUrl || "/images/product-placeholder.jpg"}
              alt={recap.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />

            {/* Project Badge */}
            <div className="absolute top-2 left-2">
              <Link
                href={`/projects/${recap.project.id}`}
                className="inline-flex items-center px-2 py-1 rounded-full bg-surface-canvas/90 backdrop-blur-sm text-xs font-medium text-folio-text-primary hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {recap.project.name}
              </Link>
            </div>
          </div>

          {/* Product Info */}
          <div className="p-3">
            <h3 className="font-medium text-folio-text-primary mb-1 line-clamp-2 text-sm">
              {recap.name}
            </h3>

            {recap.vendor?.name && (
              <p className="text-xs text-folio-text-secondary mb-1 line-clamp-1">
                {recap.vendor.name}
              </p>
            )}

            {recap.price && (
              <div className="mt-2">
                <span className="text-sm font-semibold text-[var(--accent)]">
                  ${recap.price.toLocaleString()}
                </span>
              </div>
            )}

            <div className="mt-2 text-xs text-folio-text-tertiary">
              Saved {new Date(recap.savedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 