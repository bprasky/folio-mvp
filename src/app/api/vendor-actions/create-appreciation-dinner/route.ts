export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";

interface Guest {
  designerId: string;
  name: string;
  firm: string;
  ytdInfluence: number;
  lifetimePipeline: number;
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
  prestigeStars: string;
  budget: {
    venueMenuWine: number;
    gifting: number;
    photography: number;
    total: number;
  };
}

interface AppreciationDinnerPlan {
  eventName: string;
  guests: Guest[];
  recommendedDate: string;
  options: EventOption[];
}

// Prestige venues by city
const PRESTIGE_VENUES: Record<string, { name: string; address: string }> = {
  "New York": {
    name: "The Grill at The Four Seasons",
    address: "99 E 52nd St, New York, NY 10022",
  },
  "Los Angeles": {
    name: "Republique",
    address: "624 S La Brea Ave, Los Angeles, CA 90036",
  },
  "San Francisco": {
    name: "Gary Danko",
    address: "800 N Point St, San Francisco, CA 94109",
  },
  "Miami": {
    name: "Zuma Miami",
    address: "270 Biscayne Blvd Way, Miami, FL 33131",
  },
  "Chicago": {
    name: "Alinea",
    address: "1723 N Halsted St, Chicago, IL 60614",
  },
};

// Generate personalized reason for each designer
function generatePersonalizedReason(
  designer: any,
  engagement: any,
  projects: any[]
): string {
  const reasons = [
    `Top ${engagement.alignmentScore > 0.9 ? "champion" : "partner"} with ${engagement.activeProjectCount} active projects`,
    `Strong alignment (${Math.round(engagement.alignmentScore * 100)}%) with ${designer.specialties.join(" & ")} focus`,
    `$${(engagement.influencedProjectBudget / 1000000).toFixed(1)}M+ lifetime pipeline influence`,
    `Recent engagement: ${engagement.totalTags} tags, ${engagement.totalSpecIntentEvents} spec intents`,
    `${designer.designerTier} tier designer with ${designer.styleTags.join(", ")} aesthetic`,
  ];

  // Pick 1-2 reasons based on their profile
  if (engagement.alignmentScore > 0.85 && engagement.activeProjectCount >= 3) {
    return reasons[0];
  } else if (engagement.influencedProjectBudget > 1500000) {
    return reasons[2];
  } else if (engagement.totalTags > 50) {
    return reasons[3];
  } else {
    return reasons[1];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId } = body;

    // Use mock data (will be replaced with real data later)
    const data = mockVendorAnalyticsData;

    // Get top designers by lifetime pipeline + recent engagement
    const designersWithEngagement = data.designers.map((designer) => {
      const engagement = data.designerEngagement.find(
        (e) => e.designerId === designer.designerId
      );
      const projects = data.projects.filter(
        (p) => p.designerId === designer.designerId
      );

      if (!engagement) {
        return null;
      }

      // Calculate composite score: pipeline (70%) + engagement (30%)
      const pipelineScore = engagement.influencedProjectBudget / 1000000; // Normalize to millions
      const engagementScore =
        (engagement.totalSaves * 0.1 +
          engagement.totalTags * 0.3 +
          engagement.totalSpecIntentEvents * 0.5 +
          engagement.activeProjectCount * 0.1) /
        100;

      const compositeScore = pipelineScore * 0.7 + engagementScore * 0.3;

      return {
        designer,
        engagement,
        projects,
        compositeScore,
      };
    });

    // Filter out nulls and sort by composite score
    const sortedDesigners = designersWithEngagement
      .filter((d) => d !== null)
      .sort((a, b) => (b?.compositeScore || 0) - (a?.compositeScore || 0))
      .slice(0, 18); // Top 18

    // Filter out anyone invited in last 12 months (stub for now - would check real event history)
    // For now, we'll just take the top 12-18
    const selectedDesigners = sortedDesigners.slice(0, 12 + Math.floor(Math.random() * 7)); // 12-18 guests

    // Auto-pick city with highest concentration
    const cityCounts: Record<string, number> = {};
    selectedDesigners.forEach((item) => {
      const city = item?.designer.primaryLocationCity || "New York";
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    const topCity = Object.entries(cityCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "New York";

    // Generate guest list with personalized reasons
    const guests: Guest[] = selectedDesigners.map((item) => {
      if (!item) throw new Error("Invalid designer data");
      const { designer, engagement, projects } = item;

      return {
        designerId: designer.designerId,
        name: designer.name,
        firm: designer.firmName,
        ytdInfluence: engagement.influencedProjectBudget * 0.4, // Estimate YTD as 40% of lifetime
        lifetimePipeline: engagement.influencedProjectBudget,
        personalizedReason: generatePersonalizedReason(designer, engagement, projects),
      };
    });

    const guestCount = guests.length;
    const totalLifetimePipeline = guests.reduce(
      (sum, g) => sum + g.lifetimePipeline,
      0
    );

    // Generate recommended date (first Friday of December 2025)
    const recommendedDate = "Friday, December 5, 2025";

    // Option 1: Classic Restaurant ($22-30k)
    const classicVenue = PRESTIGE_VENUES[topCity] || PRESTIGE_VENUES["New York"];
    const classicVenueMenuWine = 18000 + guestCount * 200;
    const classicGifting = guestCount * 400;
    const classicPhotography = 4000;
    const classicTotal = classicVenueMenuWine + classicGifting + classicPhotography;
    const classicUnlock = classicTotal * 95; // 95× ROI

    // Option 2: Showroom Masterclass ($6-11k)
    const showroomVenueMenuWine = guestCount * 180; // Catered
    const showroomGifting = guestCount * 200;
    const showroomPhotography = 2000;
    const showroomTotal = showroomVenueMenuWine + showroomGifting + showroomPhotography;
    const showroomUnlock = showroomTotal * 90; // 90× ROI

    // Option 3: Off-Site Experience ($18-28k)
    const offsiteVenueMenuWine = 12000 + guestCount * 250;
    const offsiteGifting = guestCount * 450;
    const offsitePhotography = 5000;
    const offsiteTotal = offsiteVenueMenuWine + offsiteGifting + offsitePhotography;
    const offsiteUnlock = offsiteTotal * 100; // 100× ROI

    const options: EventOption[] = [
      {
        conceptName: "Classic Restaurant",
        venue: {
          name: classicVenue.name,
          city: topCity,
          address: classicVenue.address,
        },
        costRange: "$22–30k",
        projectedUnlock: classicUnlock,
        guestCapacity: 16,
        whyThisWorks: "Maximum prestige and exclusivity in a world-class setting",
        prestigeStars: "★★★★★",
        budget: {
          venueMenuWine: classicVenueMenuWine,
          gifting: classicGifting,
          photography: classicPhotography,
          total: classicTotal,
        },
      },
      {
        conceptName: "Showroom Masterclass",
        venue: {
          name: `${data.vendor.name} Showroom`,
          city: topCity,
          address: "Your showroom (catered by local chef)",
        },
        costRange: "$6–11k",
        projectedUnlock: showroomUnlock,
        guestCapacity: 22 + Math.floor(Math.random() * 7), // 22-28
        whyThisWorks: "Intimate control, zero venue cost, and hands-on product experience",
        prestigeStars: "★★★★★",
        budget: {
          venueMenuWine: showroomVenueMenuWine,
          gifting: showroomGifting,
          photography: showroomPhotography,
          total: showroomTotal,
        },
      },
      {
        conceptName: "Off-Site Experience",
        venue: {
          name: topCity === "New York" ? "Private Loft (Tribeca)" : topCity === "Los Angeles" ? "Rooftop Venue (Arts District)" : "Private Gallery Space",
          city: topCity,
          address: "Custom venue with slab installation",
        },
        costRange: "$18–28k",
        projectedUnlock: offsiteUnlock,
        guestCapacity: 18 + Math.floor(Math.random() * 3), // 18-20
        whyThisWorks: "Unforgettable setting that showcases products in a unique context",
        prestigeStars: "★★★★★",
        budget: {
          venueMenuWine: offsiteVenueMenuWine,
          gifting: offsiteGifting,
          photography: offsitePhotography,
          total: offsiteTotal,
        },
      },
    ];

    const plan: AppreciationDinnerPlan = {
      eventName: `${data.vendor.name} Champions Dinner – December 2025`,
      guests,
      recommendedDate,
      options,
    };

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[create-appreciation-dinner] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate appreciation dinner plan" },
      { status: 500 }
    );
  }
}

