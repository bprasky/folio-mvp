"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const RADIUS_OPTIONS = [10, 25, 50, 100];

export default function LocalContextHeader({
  city,
  radius,
}: {
  city: string;
  radius: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [localCity, setLocalCity] = useState(city);
  const [localRadius, setLocalRadius] = useState<number>(radius);

  useEffect(() => setLocalCity(city), [city]);
  useEffect(() => setLocalRadius(radius), [radius]);

  function pushUpdate(nextCity: string, nextRadius: number) {
    const sp = new URLSearchParams(params?.toString());
    sp.set("city", nextCity);
    sp.set("radius", String(nextRadius));
    router.push(`/events?${sp.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-[var(--text-secondary)]">
        <span className="font-serif text-lg text-[var(--text-primary)]">Showing events near {localCity}</span>
        <span className="ml-2 text-sm opacity-80">Sorted by distance</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Radius chips */}
        <div className="flex items-center gap-1">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border border-[var(--ridge-outer)] hover:border-[var(--text-secondary)] transition",
                r === localRadius ? "bg-[var(--text-primary)] text-[var(--bg-base)]" : "bg-[var(--bg-base)] text-[var(--text-primary)]"
              )}
              onClick={() => {
                setLocalRadius(r);
                pushUpdate(localCity, r);
              }}
            >
              {r} mi
            </button>
          ))}
        </div>

        {/* City input (compact) */}
        <div className="ml-2">
          <label className="sr-only" htmlFor="city">City</label>
          <input
            id="city"
            value={localCity}
            onChange={(e) => setLocalCity(e.target.value)}
            onBlur={() => pushUpdate(localCity.trim(), localRadius)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                pushUpdate(localCity.trim(), localRadius);
              }
            }}
            placeholder="City"
            className="px-3 py-1.5 rounded-full text-sm border border-[var(--ridge-outer)] bg-[var(--bg-base)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-secondary)] transition min-w-[140px]"
          />
        </div>
      </div>
    </div>
  );
}









