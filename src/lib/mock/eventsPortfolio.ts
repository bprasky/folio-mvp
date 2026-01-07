export interface PortfolioKpis {
  totalRsvps: number;
  totalSaves: number;
  estValueUsd: number;
  activeDesigners: number;
  deltas: {
    rsvpsPct: number;
    savesPct: number;
    valuePct: number;
    designersPct: number;
  };
}

export interface EventSummary {
  id: string;
  name: string;
  rsvps: number;
  saves: number;
  estValueUsd: number;
  city: string;
}

export interface PortfolioGrowthPoint {
  date: string;
  saves: number;
}

export interface Benchmarks {
  bestEventId: string;
  mostImprovedId: string;
  topMarket: {
    city: string;
    sharePct: number;
  };
}

// Mock data for portfolio analytics
export function getPortfolioKpis(): PortfolioKpis {
  return {
    totalRsvps: 7417,
    totalSaves: 2668,
    estValueUsd: 20200000,
    activeDesigners: 1247,
    deltas: {
      rsvpsPct: 12.3,
      savesPct: -2.1,
      valuePct: 8.7,
      designersPct: 15.2
    }
  };
}

export function getPortfolioEventSummaries(): EventSummary[] {
  return [
    {
      id: "event-1",
      name: "NYCxDesign 2026",
      rsvps: 2314,
      saves: 842,
      estValueUsd: 6800000,
      city: "New York"
    },
    {
      id: "event-2",
      name: "Miami Design Week 2026",
      rsvps: 1856,
      saves: 623,
      estValueUsd: 4200000,
      city: "Miami"
    },
    {
      id: "event-3",
      name: "ICFF 2025",
      rsvps: 3247,
      saves: 1203,
      estValueUsd: 9200000,
      city: "New York"
    }
  ];
}

export function getPortfolioGrowthData(): PortfolioGrowthPoint[] {
  const points: PortfolioGrowthPoint[] = [];
  const baseDate = new Date('2024-01-01');
  
  // Generate monthly data for the last 12 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(baseDate);
    date.setMonth(date.getMonth() + i);
    
    // Simulate growth with some randomness
    const baseSaves = 150 + (i * 25) + (Math.random() * 100 - 50);
    
    points.push({
      date: date.toISOString().split('T')[0],
      saves: Math.max(0, Math.round(baseSaves))
    });
  }
  
  return points;
}

export function getPortfolioBenchmarks(): Benchmarks {
  return {
    bestEventId: "event-3", // ICFF 2025
    mostImprovedId: "event-1", // NYCxDesign 2026
    topMarket: {
      city: "New York",
      sharePct: 42.3
    }
  };
}

// Calculate portfolio averages
export function getPortfolioAverages(): {
  avgRsvps: number;
  avgSaves: number;
  avgValueUsd: number;
} {
  const events = getPortfolioEventSummaries();
  
  return {
    avgRsvps: Math.round(events.reduce((sum, e) => sum + e.rsvps, 0) / events.length),
    avgSaves: Math.round(events.reduce((sum, e) => sum + e.saves, 0) / events.length),
    avgValueUsd: Math.round(events.reduce((sum, e) => sum + e.estValueUsd, 0) / events.length)
  };
}









