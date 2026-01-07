import type { MarketRow } from "@/lib/mock/eventPost";

export interface GeoAction {
  type: 'local_event' | 'connect_designers' | 'localized_assets' | 'cross_boost' | 'promo_boost';
  label: string;
  payload: any;
  expectedLiftUsd: number;
}

export function actionsForMarket(
  market: MarketRow,
  medianShare: number,
  medianPotential: number
): GeoAction[] {
  const actions: GeoAction[] = [];
  const underserved = market.sharePct < medianShare && market.saves > medianPotential;
  const saturated = market.sharePct >= medianShare && market.trendDeltaPct >= 0;

  if (underserved) {
    actions.push(
      {
        type: 'local_event',
        label: `Host micro-event in ${market.city} with Folio designers`,
        payload: { city: market.city },
        expectedLiftUsd: 150000
      },
      {
        type: 'connect_designers',
        label: `Connect with 10 ${market.city} designers`,
        payload: { city: market.city, count: 10 },
        expectedLiftUsd: 85000
      },
      {
        type: 'localized_assets',
        label: `Commission ${market.city} renders/photos`,
        payload: { city: market.city },
        expectedLiftUsd: 120000
      },
      {
        type: 'cross_boost',
        label: `Cross-boost NYC post into ${market.city}`,
        payload: { from: 'NYC', to: market.city },
        expectedLiftUsd: 65000
      }
    );
  }

  if (saturated && market.badge === 'Hot') {
    actions.push(
      {
        type: 'promo_boost',
        label: `Run designer boost targeted to ${market.city} look-alikes`,
        payload: { city: market.city },
        expectedLiftUsd: 95000
      }
    );
  }

  return actions.slice(0, 3);
}








