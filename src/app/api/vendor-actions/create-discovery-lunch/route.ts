export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";

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

// Casual-chic daytime venues by city
const DISCOVERY_VENUES: Record<string, { name: string; address: string }> = {
  "New York": {
    name: "The Noortwyck",
    address: "289 Bleecker St, New York, NY 10014",
  },
  "Los Angeles": {
    name: "Sister City",
    address: "1200 S Olive St, Los Angeles, CA 90015",
  },
  "San Francisco": {
    name: "The Maker Hotel Restaurant",
    address: "302 Geary St, San Francisco, CA 94102",
  },
  "Miami": {
    name: "Mandolin Aegean Bistro",
    address: "4312 NE 2nd Ave, Miami, FL 33137",
  },
  "Chicago": {
    name: "Cafe Robey",
    address: "1958 W North Ave, Chicago, IL 60622",
  },
};

// Generate personalized reason for discovery lunch guests
function generateDiscoveryReason(
  designer: any,
  engagement: any
): { reason: string; similarProductSignal: string } {
  // Mock signals for similar products (in real app, would query competitor saves/tags)
  const signals = [
    "Saved Cosentino Dekton 8×, never tried natural marble",
    "Follows Calacatta suppliers but no interaction with Ondulato",
    "Tagged veiny marbles from 3 other vendors, zero saves on yours",
    "Active in hospitality projects using similar stone categories",
    "Saved bookmatched slabs from competitors, never engaged with your collection",
  ];

  const reasons = [
    `High-potential acquisition target with ${engagement.activeProjectCount || 0} active projects`,
    `Strong style fit (${designer.styleTags?.slice(0, 2).join(", ") || "modern"}) but zero engagement`,
    `YTD influence $${(engagement.influencedProjectBudget * 0.4 / 1000).toFixed(0)}k suggests strong spec intent`,
    `Firm size ${Math.floor(Math.random() * 20) + 5} designers — right scale for discovery`,
  ];

  const signal = signals[Math.floor(Math.random() * signals.length)];
  const reason = reasons[Math.floor(Math.random() * reasons.length)];

  return { reason, similarProductSignal: signal };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId } = body;

    // Use mock data (will be replaced with real data later)
    const data = mockVendorAnalyticsData;

    // Find designers who:
    // 1. Are in top 3 metro areas for this vendor
    // 2. Have YTD influence $80k-$450k (the hungry middle)
    // 3. Have zero saves/tags on vendor products (mock: low engagement)
    // 4. Firm size 4-25 (mock: use designer tier as proxy)

    const topCities = ["New York", "Los Angeles", "San Francisco", "Miami", "Chicago"];
    const cityCounts: Record<string, number> = {};
    
    data.designers.forEach((designer) => {
      const city = designer.primaryLocationCity;
      if (topCities.includes(city)) {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });

    const top3Cities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city]) => city);

    // Filter designers for discovery lunch criteria
    const discoveryCandidates = data.designers
      .map((designer) => {
        const engagement = data.designerEngagement.find(
          (e) => e.designerId === designer.designerId
        );

        if (!engagement) return null;

        // Check criteria:
        // - In top 3 cities
        // - YTD influence $80k-$450k (estimate as 40% of lifetime)
        const ytdEstimate = engagement.influencedProjectBudget * 0.4;
        const isRightCity = top3Cities.includes(designer.primaryLocationCity);
        const isRightTier = ytdEstimate >= 80000 && ytdEstimate <= 450000;
        const hasLowEngagement = engagement.totalSaves === 0 && engagement.totalTags === 0;

        if (isRightCity && isRightTier && hasLowEngagement) {
          return {
            designer,
            engagement,
            ytdEstimate,
          };
        }

        return null;
      })
      .filter((d) => d !== null)
      .sort((a, b) => (b?.ytdEstimate || 0) - (a?.ytdEstimate || 0))
      .slice(0, 14); // 10-14 guests

    // If we don't have enough candidates, relax criteria (for demo purposes)
    if (discoveryCandidates.length < 10) {
      // Fallback: use any designers in top cities with moderate engagement
      const fallbackCandidates = data.designers
        .map((designer) => {
          const engagement = data.designerEngagement.find(
            (e) => e.designerId === designer.designerId
          );
          if (!engagement) return null;
          const ytdEstimate = engagement.influencedProjectBudget * 0.4;
          if (top3Cities.includes(designer.primaryLocationCity) && ytdEstimate >= 50000) {
            return { designer, engagement, ytdEstimate };
          }
          return null;
        })
        .filter((d) => d !== null)
        .sort((a, b) => (b?.ytdEstimate || 0) - (a?.ytdEstimate || 0))
        .slice(0, 14);

      discoveryCandidates.push(...fallbackCandidates.slice(0, 14 - discoveryCandidates.length));
    }

    // Select 10-14 guests
    const selectedGuests = discoveryCandidates.slice(0, 10 + Math.floor(Math.random() * 5));

    // Auto-pick city with highest concentration
    const guestCityCounts: Record<string, number> = {};
    selectedGuests.forEach((item) => {
      if (item) {
        const city = item.designer.primaryLocationCity;
        guestCityCounts[city] = (guestCityCounts[city] || 0) + 1;
      }
    });

    const topCity = Object.entries(guestCityCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "New York";

    // Generate guest list
    const guests: Guest[] = selectedGuests.map((item) => {
      if (!item) throw new Error("Invalid designer data");
      const { designer, engagement } = item;
      const { reason, similarProductSignal } = generateDiscoveryReason(designer, engagement);

      return {
        designerId: designer.designerId,
        name: designer.name,
        firm: designer.firmName,
        ytdInfluence: item.ytdEstimate,
        similarProductSignal,
        personalizedReason: reason,
      };
    });

    const guestCount = guests.length;

    // Generate recommended date (first Tuesday of January 2025)
    const recommendedDate = "Tuesday, January 7, 2025";

    // Option 1: Daytime Restaurant ($5-8k)
    const restaurantVenue = DISCOVERY_VENUES[topCity] || DISCOVERY_VENUES["New York"];
    const restaurantLunchWine = 200 * guestCount;
    const restaurantSamples = 100 * guestCount;
    const restaurantPhotography = 800;
    const restaurantTotal = restaurantLunchWine + restaurantSamples + restaurantPhotography;
    const restaurantUnlock = restaurantTotal * 125; // 125× ROI

    // Option 2: Showroom Breakfast/Lunch ($2.5-4.5k)
    const showroomLunchWine = 120 * guestCount; // Catered breakfast/lunch
    const showroomSamples = 80 * guestCount;
    const showroomPhotography = 600;
    const showroomTotal = showroomLunchWine + showroomSamples + showroomPhotography;
    const showroomUnlock = showroomTotal * 130; // 130× ROI

    // Option 3: Gallery/Design Space ($6-9k)
    const galleryLunchWine = 180 * guestCount;
    const gallerySamples = 120 * guestCount;
    const galleryPhotography = 1200;
    const galleryTotal = galleryLunchWine + gallerySamples + galleryPhotography;
    const galleryUnlock = galleryTotal * 120; // 120× ROI

    const options: EventOption[] = [
      {
        conceptName: "Daytime Restaurant",
        venue: {
          name: restaurantVenue.name,
          city: topCity,
          address: restaurantVenue.address,
        },
        costRange: "$5–8k",
        projectedUnlock: restaurantUnlock,
        guestCapacity: guestCount,
        whyThisWorks: "Professional yet relaxed setting perfect for discovery conversations",
        format: "11:30 am arrival → seated family-style lunch → 30-min slab presentation + sample gifting",
        budget: {
          lunchWine: restaurantLunchWine,
          samples: restaurantSamples,
          photography: restaurantPhotography,
          total: restaurantTotal,
        },
      },
      {
        conceptName: "Showroom Breakfast/Lunch",
        venue: {
          name: `${data.vendor.name} Showroom`,
          city: topCity,
          address: "Your showroom (catered breakfast or lunch)",
        },
        costRange: "$2.5–4.5k",
        projectedUnlock: showroomUnlock,
        guestCapacity: guestCount + 4, // Can fit more in showroom
        whyThisWorks: "Lowest cost option with maximum product visibility and hands-on experience",
        format: "9:30 am arrival → breakfast/lunch → 45-min showroom walkthrough + sample gifting",
        budget: {
          lunchWine: showroomLunchWine,
          samples: showroomSamples,
          photography: showroomPhotography,
          total: showroomTotal,
        },
      },
      {
        conceptName: "Gallery or Design Space",
        venue: {
          name: topCity === "New York" ? "Design Gallery (SoHo)" : topCity === "Los Angeles" ? "Design Studio (Arts District)" : "Contemporary Gallery Space",
          city: topCity,
          address: "Curated design space with product installation",
        },
        costRange: "$6–9k",
        projectedUnlock: galleryUnlock,
        guestCapacity: guestCount,
        whyThisWorks: "Memorable setting that positions your products as art and design objects",
        format: "11:00 am arrival → gallery walkthrough → seated lunch → 30-min presentation + samples",
        budget: {
          lunchWine: galleryLunchWine,
          samples: gallerySamples,
          photography: galleryPhotography,
          total: galleryTotal,
        },
      },
    ];

    const plan: DiscoveryLunchPlan = {
      eventName: `${data.vendor.name} Discovery Lunch – January 2025`,
      guests,
      recommendedDate,
      options,
    };

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[create-discovery-lunch] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate discovery lunch plan" },
      { status: 500 }
    );
  }
}

