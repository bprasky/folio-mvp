// DEPRECATED: Replaced by CreateAppreciationDinnerModal.tsx (prestige centered modal)
// This drawer is kept for reference but should not be used.

/* 
"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Guest {
  designerId: string;
  name: string;
  firm: string;
  ytdInfluence: number;
  lifetimePipeline: number;
  personalizedReason: string;
}

interface AppreciationDinnerPlan {
  eventName: string;
  guests: Guest[];
  recommendedVenue: {
    name: string;
    city: string;
    address?: string;
  };
  recommendedDate: string;
  budget: {
    venueMenuWine: number;
    gifting: number;
    photography: number;
    total: number;
  };
  projectedUnlock: number;
  roiMultiplier: number;
}

interface CreateAppreciationDinnerDrawerProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
}

export function CreateAppreciationDinnerDrawer({
  open,
  onClose,
  vendorId,
}: CreateAppreciationDinnerDrawerProps) {
  const [plan, setPlan] = useState<AppreciationDinnerPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !plan) {
      loadPlan();
    }
  }, [open]);

  const loadPlan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vendor-actions/create-appreciation-dinner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate dinner plan");
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

  const handleLockPlan = async () => {
    // TODO: Implement actual locking logic
    console.log("Locking plan:", plan);
    alert("Plan locked! (This will create Event + Segment + send invites in production)");
  };

  const handleEditGuestList = () => {
    // TODO: Implement edit functionality
    console.log("Edit guest list");
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    console.log("Download PDF deck");
    alert("PDF download coming soon");
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[800px] bg-[#fdfbf8] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-serif text-neutral-900">
            Your Appreciation Dinner – December 2025
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="mt-8 text-center text-neutral-600">
            <p>Generating your appreciation dinner plan...</p>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p>{error}</p>
          </div>
        )}

        {plan && !isLoading && (
          <div className="mt-6 space-y-8">
            {/* Guest List Table */}
            <section>
              <h3 className="text-lg font-serif text-neutral-900 mb-4">Guest List</h3>
              <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-700">Designer</th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-700">Firm</th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-700">YTD Influence</th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-700">Lifetime Pipeline</th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-700">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {plan.guests.map((guest) => (
                      <tr key={guest.designerId} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-medium text-neutral-900">{guest.name}</td>
                        <td className="px-4 py-3 text-neutral-600">{guest.firm}</td>
                        <td className="px-4 py-3 text-right text-neutral-700">
                          ${(guest.ytdInfluence / 1000).toFixed(0)}k
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-700">
                          ${(guest.lifetimePipeline / 1000).toFixed(0)}k
                        </td>
                        <td className="px-4 py-3 text-neutral-600 text-xs max-w-xs">
                          {guest.personalizedReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recommended Venue + Date */}
            <section>
              <h3 className="text-lg font-serif text-neutral-900 mb-4">Recommended Venue & Date</h3>
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <div className="space-y-2">
                  <p className="text-xl font-medium text-neutral-900">{plan.recommendedVenue.name}</p>
                  <p className="text-sm text-neutral-600">{plan.recommendedVenue.city}</p>
                  {plan.recommendedVenue.address && (
                    <p className="text-xs text-neutral-500">{plan.recommendedVenue.address}</p>
                  )}
                  <p className="text-sm text-neutral-700 mt-4">
                    <span className="font-medium">Recommended Date:</span> {plan.recommendedDate}
                  </p>
                </div>
              </div>
            </section>

            {/* Spend & ROI Breakdown */}
            <section>
              <h3 className="text-lg font-serif text-neutral-900 mb-4">Spend & ROI Breakdown</h3>
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-neutral-200">
                    <tr>
                      <td className="px-4 py-3 text-neutral-600">Venue / Menu / Wine</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">
                        ${plan.budget.venueMenuWine.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-neutral-600">Gifting</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">
                        ${plan.budget.gifting.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-neutral-600">Photography</td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-900">
                        ${plan.budget.photography.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-neutral-300">
                      <td className="px-4 py-3 font-medium text-neutral-900">Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                        ${plan.budget.total.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-6 pt-6 border-t border-neutral-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Projected 24-Month Unlock</span>
                    <span className="text-2xl font-serif text-neutral-900">
                      ${(plan.projectedUnlock / 1000000).toFixed(1)}M+
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Conservative {plan.roiMultiplier}× ROI estimate based on historical appreciation dinner performance
                  </p>
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <section className="pt-6 border-t border-neutral-200">
              <div className="flex gap-3">
                <button
                  onClick={handleLockPlan}
                  className="flex-1 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
                >
                  Lock This Plan
                </button>
                <button
                  onClick={handleEditGuestList}
                  className="px-6 py-3 rounded-full border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
                >
                  Edit Guest List / Budget
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-6 py-3 rounded-full border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
                >
                  Download PDF Deck
                </button>
              </div>
            </section>

            {/* Footer Badge */}
            <div className="pt-6 border-t border-neutral-200 text-center">
              <p className="text-xs text-neutral-400">
                Powered by <span className="font-medium">Grok-4</span>
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

