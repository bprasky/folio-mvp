// Prestige modal – Discovery Lunch for acquisition – Nov 21 2025

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Guest {
  designerId: string;
  name: string;
  firm: string;
  ytdInfluence: number;
  similarProductSignal: string;
  personalizedReason: string;
}

interface EventOption {
  conceptName: string;
  venue: {
    name: string;
    city: string;
    address?: string;
  };
  costRange: string;
  projectedUnlock: number;
  guestCapacity: number;
  whyThisWorks: string;
  format: string;
  budget: {
    lunchWine: number;
    samples: number;
    photography: number;
    total: number;
  };
}

interface DiscoveryLunchPlan {
  eventName: string;
  guests: Guest[];
  recommendedDate: string;
  options: EventOption[];
}

interface CreateDiscoveryLunchModalProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
}

export function CreateDiscoveryLunchModal({
  open,
  onClose,
  vendorId,
}: CreateDiscoveryLunchModalProps) {
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<DiscoveryLunchPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && !plan) {
      loadPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPlan(null);
      setError(null);
    }
  }, [open]);

  const loadPlan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vendor-actions/create-discovery-lunch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate discovery lunch plan");
      }

      const data = await response.json();
      setPlan(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = async (option: EventOption) => {
    console.log("Creating private educational event with option:", option);
    alert(`Creating private educational event: ${option.conceptName}... (This will be wired to real mutations)`);
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4" 
      style={{ backgroundColor: "rgba(27, 25, 23, 0.92)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-surface-ground border border-[#b89a72] rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-0 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#b89a72] focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-folio-text-primary" />
        </button>

        <div className="absolute right-16 top-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-[#b89a72]/10 border border-[#b89a72]/30 rounded-full">
          <span className="text-[#b89a72] text-xs font-medium">Invite-Only Event</span>
          <span className="text-[#b89a72] text-xs">★</span>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-[32px] font-serif text-folio-text-primary leading-tight">
              {plan?.eventName || "Discovery Lunch – January 2025"}
            </h2>
          </div>

          {isLoading && (
            <div className="py-12 text-center text-folio-text-secondary">
              <p>Generating your discovery lunch plan...</p>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <p>{error}</p>
            </div>
          )}

          {plan && !isLoading && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-serif text-folio-text-primary mb-4">Guest List</h3>
                <div className="border border-folio-border-subtle rounded-lg overflow-hidden bg-surface-canvas">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-ground border-b border-folio-border-subtle">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-folio-text-primary">Designer</th>
                        <th className="px-4 py-3 text-left font-medium text-folio-text-primary">Firm</th>
                        <th className="px-4 py-3 text-right font-medium text-folio-text-primary">YTD Influence</th>
                        <th className="px-4 py-3 text-left font-medium text-folio-text-primary">Similar Product Signal</th>
                        <th className="px-4 py-3 text-left font-medium text-folio-text-primary">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ridge-outer)]">
                      {plan.guests.map((guest) => (
                        <tr key={guest.designerId} className="hover:bg-surface-ground">
                          <td className="px-4 py-3 font-medium text-folio-text-primary">{guest.name}</td>
                          <td className="px-4 py-3 text-folio-text-secondary">{guest.firm}</td>
                          <td className="px-4 py-3 text-right text-folio-text-primary">
                            ${(guest.ytdInfluence / 1000).toFixed(0)}k
                          </td>
                          <td className="px-4 py-3 text-folio-text-secondary text-xs max-w-xs">
                            {guest.similarProductSignal}
                          </td>
                          <td className="px-4 py-3 text-folio-text-secondary text-xs max-w-xs">
                            {guest.personalizedReason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-serif text-folio-text-primary mb-4">Choose Your Event Concept</h3>
                <p className="text-sm text-folio-text-secondary mb-6">
                  <span className="font-medium">Recommended Date:</span> {plan.recommendedDate}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible">
                  {plan.options.map((option, index) => (
                    <div
                      key={index}
                      className="flex-shrink-0 w-full md:w-auto bg-surface-canvas border border-folio-border-subtle rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {/* Hero image placeholder */}
                      <div className="h-32 bg-[var(--ridge-inner)] flex items-center justify-center">
                        <span className="text-xs text-folio-text-secondary uppercase tracking-wide">Event Image</span>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="text-base font-serif text-folio-text-primary">{option.conceptName}</h4>
                          <p className="text-xs text-folio-text-secondary mt-1">{option.venue.name}</p>
                          <p className="text-xs text-folio-text-secondary">{option.venue.city}</p>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-folio-text-secondary">Cost:</span>
                            <span className="font-medium text-folio-text-primary">{option.costRange}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-folio-text-secondary">Capacity:</span>
                            <span className="font-medium text-folio-text-primary">{option.guestCapacity} guests</span>
                          </div>
                          <div className="flex justify-between items-start">
                            <span className="text-folio-text-secondary">Unlock:</span>
                            <span className="font-serif text-folio-text-primary text-right">
                              ${(option.projectedUnlock / 1000000).toFixed(1)}M+
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-folio-text-secondary italic pt-2 border-t border-[var(--ridge-inner)]">
                          {option.whyThisWorks}
                        </p>

                        <div className="text-xs text-folio-text-secondary pt-2 border-t border-[var(--ridge-inner)]">
                          <p className="font-medium mb-1">Format:</p>
                          <p>{option.format}</p>
                        </div>

                        <button
                          onClick={() => handleSelectPlan(option)}
                          className="w-full mt-4 rounded-full bg-[var(--text-primary)] px-4 py-2.5 text-xs font-medium text-[#b89a72] hover:opacity-90 transition-colors"
                        >
                          Select This Plan →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-6 border-t border-folio-border-subtle text-right">
                <p className="text-xs text-folio-text-secondary">
                  Powered by <span className="font-medium">Grok-4</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

