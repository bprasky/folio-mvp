import type { EventPostReport } from "@/lib/mock/eventPost";

export interface DriverDelta {
  driver: string;
  impact: number; // pts
  section?: 'roomPhase' | 'geo' | 'products';
  anchorKey?: string;
}

export function driverDelta(report: EventPostReport): DriverDelta[] {
  const drivers: DriverDelta[] = [];

  // Find top room-phase contribution
  const topRoomPhase = report.roomPhase?.reduce((best, current) => 
    current.saveToTagRatePct > best.saveToTagRatePct ? current : best
  );
  if (topRoomPhase && topRoomPhase.saveToTagRatePct > 55) {
    drivers.push({
      driver: `${topRoomPhase.room} ${topRoomPhase.phase} asset quality`,
      impact: topRoomPhase.saveToTagRatePct - 45, // vs baseline
      section: 'roomPhase',
      anchorKey: `${topRoomPhase.room}|${topRoomPhase.phase}`
    });
  }

  // Find market impact
  const weakMarket = report.markets.find(m => m.sharePct < 15 && m.badge !== 'Underserved');
  if (weakMarket) {
    drivers.push({
      driver: `${weakMarket.city} low share`,
      impact: -(20 - weakMarket.sharePct), // negative impact
      section: 'geo',
      anchorKey: weakMarket.city
    });
  }

  // Find spec sheet contribution
  const specHeavyPhase = report.roomPhase?.find(rp => 
    rp.phase === 'Procurement' && rp.saveToTagRatePct > 50 && !rp.assetGap
  );
  if (specHeavyPhase) {
    drivers.push({
      driver: `${specHeavyPhase.room} procurement spec sheets`,
      impact: 5,
      section: 'roomPhase',
      anchorKey: `${specHeavyPhase.room}|${specHeavyPhase.phase}`
    });
  }

  // Sort by absolute impact
  return drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3);
}








