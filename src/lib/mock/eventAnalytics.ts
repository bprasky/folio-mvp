export type RoomType = "Kitchen" | "Bath" | "Living" | "Bedroom" | "Outdoor" | "Other";
export type ProjectPhase = "Concept" | "Schematic" | "FF&E" | "Procurement";

export interface EventKpis {
  rsvps: number;
  attendanceRatePct?: number; // optional
  productsSaved: number;
  estProjectValueUsd: number;
}

export interface TimeSeriesPoint { 
  date: string; 
  saves: number; 
}

export interface RoomSaves { 
  room: RoomType; 
  count: number; 
}

export interface PhaseBreakdown { 
  phase: ProjectPhase; 
  pct: number; 
}

export interface CityHeat { 
  city: string; 
  count: number; 
}

export interface TopDesigner {
  id: string;
  name: string;
  firm?: string;
  city?: string;
  avatarUrl?: string;
  saves: number;
  estProjectValueUsd: number;
}

export interface TopProduct {
  id: string;
  name: string;
  vendor: string;
  thumbUrl?: string;
  saves: number;
  ctaUrl?: string; // to product page
}

export interface TrendMaterial {
  name: string;
  deltaPct: number; // +/- percentage
}

export interface RecommendedInvite {
  id: string;
  name: string;
  reason: string; // e.g., "Often attends with Studio Linares"
}

export interface EventAnalytics {
  eventId: string;
  eventName: string;
  dates: { start: string; end: string; };
  location: { city: string; country?: string; };
  kpis: EventKpis;
  timeSeries: TimeSeriesPoint[];
  savesByRoom: RoomSaves[];
  phases: PhaseBreakdown[];
  geo: CityHeat[];
  topDesigners: TopDesigner[];
  topProducts: TopProduct[];
  trends: TrendMaterial[];
  recommendedInvites: RecommendedInvite[];
  // New fields for smart analytics
  influenceScoreByDesigner?: Record<string, number>;
  roomSharePct?: Array<{ room: RoomType; pct: number; trendDeltaPct?: number }>;
  cityShareTrend?: Array<{ city: string; pct: number; trendDeltaPct?: number }>;
  phaseIntent?: Array<{ phase: ProjectPhase; pct: number; assetGap?: 'images'|'renders'|'specs' }>;
  flowCounts?: { event: number; saves: number; boards: number; tags: number; valueUsd: number };
}

export interface VendorEvent {
  id: string;
  name: string;
  dates: { start: string; end: string; };
  location: { city: string; country?: string; };
  rsvps: number;
  productsSaved: number;
  estProjectValueUsd: number;
  status: 'upcoming' | 'active' | 'completed';
}

// Mock data generators
export function getVendorEvents(): VendorEvent[] {
  return [
    {
      id: "event-1",
      name: "NYCxDesign 2026",
      dates: { start: "2026-05-15T09:00:00Z", end: "2026-05-20T18:00:00Z" },
      location: { city: "New York", country: "US" },
      rsvps: 2314,
      productsSaved: 842,
      estProjectValueUsd: 6800000,
      status: 'upcoming'
    },
    {
      id: "event-2", 
      name: "Miami Design Week 2026",
      dates: { start: "2026-01-15T10:00:00Z", end: "2026-01-19T17:00:00Z" },
      location: { city: "Miami", country: "US" },
      rsvps: 1856,
      productsSaved: 623,
      estProjectValueUsd: 4200000,
      status: 'upcoming'
    },
    {
      id: "event-3",
      name: "ICFF 2025",
      dates: { start: "2025-05-19T08:00:00Z", end: "2025-05-22T18:00:00Z" },
      location: { city: "New York", country: "US" },
      rsvps: 3247,
      productsSaved: 1203,
      estProjectValueUsd: 9200000,
      status: 'completed'
    }
  ];
}

export function getEventAnalytics(eventId: string): EventAnalytics {
  // Return different data based on eventId for variety
  const baseAnalytics: EventAnalytics = {
    eventId,
    eventName: eventId === "event-1" ? "NYCxDesign 2026" : 
               eventId === "event-2" ? "Miami Design Week 2026" : "ICFF 2025",
    dates: eventId === "event-1" ? 
      { start: "2026-05-15T09:00:00Z", end: "2026-05-20T18:00:00Z" } :
      eventId === "event-2" ?
      { start: "2026-01-15T10:00:00Z", end: "2026-01-19T17:00:00Z" } :
      { start: "2025-05-19T08:00:00Z", end: "2025-05-22T18:00:00Z" },
    location: eventId === "event-1" ? { city: "New York", country: "US" } :
              eventId === "event-2" ? { city: "Miami", country: "US" } :
              { city: "New York", country: "US" },
    kpis: {
      rsvps: eventId === "event-1" ? 2314 : eventId === "event-2" ? 1856 : 3247,
      attendanceRatePct: eventId === "event-1" ? 62 : eventId === "event-2" ? 58 : 74,
      productsSaved: eventId === "event-1" ? 842 : eventId === "event-2" ? 623 : 1203,
      estProjectValueUsd: eventId === "event-1" ? 6800000 : eventId === "event-2" ? 4200000 : 9200000
    },
    timeSeries: generateTimeSeries(),
    savesByRoom: generateRoomSaves(),
    phases: [
      { phase: "Concept", pct: 40 },
      { phase: "Schematic", pct: 25 },
      { phase: "FF&E", pct: 25 },
      { phase: "Procurement", pct: 10 }
    ],
    geo: [
      { city: "New York", count: eventId === "event-1" ? 320 : 180 },
      { city: "Miami", count: eventId === "event-2" ? 180 : 95 },
      { city: "Los Angeles", count: 140 },
      { city: "Chicago", count: 95 },
      { city: "Milan", count: 70 }
    ],
    topDesigners: generateTopDesigners(eventId),
    topProducts: generateTopProducts(eventId),
    trends: [
      { name: "Terra Travertine", deltaPct: 18 },
      { name: "Smoked Oak", deltaPct: 12 },
      { name: "Brushed Brass", deltaPct: 9 },
      { name: "Concrete Finishes", deltaPct: 7 },
      { name: "Velvet Upholstery", deltaPct: -3 }
    ],
    recommendedInvites: generateRecommendedInvites(),
    // New smart analytics fields
    influenceScoreByDesigner: generateInfluenceScores(eventId),
    roomSharePct: generateRoomShareData(),
    cityShareTrend: generateCityShareTrend(),
    phaseIntent: generatePhaseIntent(),
    flowCounts: generateFlowCounts(eventId)
  };

  return baseAnalytics;
}

function generateTimeSeries(): TimeSeriesPoint[] {
  const days = [];
  const baseDate = new Date('2026-05-15');
  
  for (let i = 0; i < 6; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    days.push({
      date: date.toISOString().split('T')[0],
      saves: Math.floor(Math.random() * 200) + 50
    });
  }
  
  return days;
}

function generateRoomSaves(): RoomSaves[] {
  return [
    { room: "Kitchen", count: 245 },
    { room: "Bath", count: 180 },
    { room: "Living", count: 165 },
    { room: "Bedroom", count: 142 },
    { room: "Outdoor", count: 68 },
    { room: "Other", count: 42 }
  ];
}

function generateTopDesigners(eventId: string): TopDesigner[] {
  const designers = [
    {
      id: "designer-1",
      name: "Sarah Chen",
      firm: "Studio Linares",
      city: "New York",
      avatarUrl: "/images/designers/sarah-chen.jpg",
      saves: 47,
      estProjectValueUsd: eventId === "event-1" ? 1200000 : 900000
    },
    {
      id: "designer-2", 
      name: "Marcus Rodriguez",
      firm: "Rodriguez & Associates",
      city: "Miami",
      avatarUrl: "/images/designers/marcus-rodriguez.jpg",
      saves: 38,
      estProjectValueUsd: 850000
    },
    {
      id: "designer-3",
      name: "Jennifer Kim",
      firm: "Kim Design Studio",
      city: "Los Angeles", 
      avatarUrl: "/images/designers/jennifer-kim.jpg",
      saves: 35,
      estProjectValueUsd: 720000
    },
    {
      id: "designer-4",
      name: "David Thompson",
      firm: "Thompson Interiors",
      city: "Chicago",
      avatarUrl: "/images/designers/david-thompson.jpg", 
      saves: 32,
      estProjectValueUsd: 680000
    },
    {
      id: "designer-5",
      name: "Lisa Wang",
      firm: "Wang Design Co",
      city: "San Francisco",
      avatarUrl: "/images/designers/lisa-wang.jpg",
      saves: 28,
      estProjectValueUsd: 580000
    }
  ];

  return designers;
}

function generateTopProducts(eventId: string): TopProduct[] {
  return [
    {
      id: "product-1",
      name: "Marble Dining Table - Carrara",
      vendor: "Stone & Style",
      thumbUrl: "/images/products/marble-dining-table.jpg",
      saves: eventId === "event-1" ? 89 : 67,
      ctaUrl: "/product/marble-dining-table-carrara"
    },
    {
      id: "product-2",
      name: "Velvet Sectional - Deep Navy", 
      vendor: "Modern Living Co",
      thumbUrl: "/images/products/velvet-sectional.jpg",
      saves: 76,
      ctaUrl: "/product/velvet-sectional-navy"
    },
    {
      id: "product-3", 
      name: "Brass Pendant Light - Large",
      vendor: "Light & Form",
      thumbUrl: "/images/products/brass-pendant.jpg",
      saves: 71,
      ctaUrl: "/product/brass-pendant-large"
    },
    {
      id: "product-4",
      name: "Concrete Side Table",
      vendor: "Urban Materials",
      thumbUrl: "/images/products/concrete-side-table.jpg",
      saves: 65,
      ctaUrl: "/product/concrete-side-table"
    },
    {
      id: "product-5",
      name: "Wool Area Rug - 8x10",
      vendor: "Textile Works",
      thumbUrl: "/images/products/wool-rug.jpg", 
      saves: 58,
      ctaUrl: "/product/wool-rug-8x10"
    }
  ];
}

function generateRecommendedInvites(): RecommendedInvite[] {
  return [
    {
      id: "invite-1",
      name: "Alexandra Stone",
      reason: "Often attends with Studio Linares"
    },
    {
      id: "invite-2", 
      name: "Michael Park",
      reason: "Active in NYCxDesign community"
    },
    {
      id: "invite-3",
      name: "Emily Rodriguez",
      reason: "Frequently saves your products"
    },
    {
      id: "invite-4",
      name: "James Wilson",
      reason: "High-value projects in Q1"
    },
    {
      id: "invite-5",
      name: "Sofia Martinez",
      reason: "Design firm growing rapidly"
    },
    {
      id: "invite-6",
      name: "Robert Kim",
      reason: "Local market influencer"
    }
  ];
}

// New smart analytics data generators
function generateInfluenceScores(eventId: string): Record<string, number> {
  return {
    "designer-1": 95, // Sarah Chen - high influence
    "designer-2": 87, // Marcus Rodriguez
    "designer-3": 82, // Jennifer Kim
    "designer-4": 78, // David Thompson
    "designer-5": 73, // Lisa Wang
  };
}

function generateRoomShareData(): Array<{ room: RoomType; pct: number; trendDeltaPct?: number }> {
  return [
    { room: "Kitchen", pct: 45, trendDeltaPct: 18 },
    { room: "Bath", pct: 28, trendDeltaPct: 12 },
    { room: "Living", pct: 22, trendDeltaPct: 5 },
    { room: "Bedroom", pct: 15, trendDeltaPct: -2 },
    { room: "Outdoor", pct: 8, trendDeltaPct: 3 },
    { room: "Other", pct: 5, trendDeltaPct: -1 }
  ];
}

function generateCityShareTrend(): Array<{ city: string; pct: number; trendDeltaPct?: number }> {
  return [
    { city: "New York", pct: 35, trendDeltaPct: 15 },
    { city: "Miami", pct: 22, trendDeltaPct: 8 },
    { city: "Los Angeles", pct: 18, trendDeltaPct: 5 },
    { city: "Chicago", pct: 12, trendDeltaPct: -3 },
    { city: "Milan", pct: 8, trendDeltaPct: 12 }
  ];
}

function generatePhaseIntent(): Array<{ phase: ProjectPhase; pct: number; assetGap?: 'images'|'renders'|'specs' }> {
  return [
    { phase: "Concept", pct: 40, assetGap: "renders" },
    { phase: "Schematic", pct: 25, assetGap: "images" },
    { phase: "FF&E", pct: 25, assetGap: "specs" },
    { phase: "Procurement", pct: 10, assetGap: "specs" }
  ];
}

function generateFlowCounts(eventId: string): { event: number; saves: number; boards: number; tags: number; valueUsd: number } {
  const baseCounts = {
    "event-1": { event: 2314, saves: 842, boards: 234, tags: 156, valueUsd: 6800000 },
    "event-2": { event: 1856, saves: 623, boards: 187, tags: 124, valueUsd: 4200000 },
    "event-3": { event: 3247, saves: 1203, boards: 445, tags: 289, valueUsd: 9200000 }
  };
  
  return baseCounts[eventId as keyof typeof baseCounts] || baseCounts["event-1"];
}
