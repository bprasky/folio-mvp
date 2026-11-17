import type { PublicCoverage } from './schema';

export function coverageFeedItems(items: PublicCoverage[]) {
  return items.map(item => ({ id: item.id, type: 'recognition' as const, data: { coverage: item },
    publishedAt: new Date(item.publishedAt), pinnedAt: null, pinOrder: null, engagement: 0 }));
}
