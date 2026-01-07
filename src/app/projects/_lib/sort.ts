export type SortKey = 'name' | 'created' | 'updated' | 'phase' | 'status';

export function normalizeSort(sortParam?: string): SortKey {
  if (!sortParam) return 'updated';
  
  const validSorts: SortKey[] = ['name', 'created', 'updated', 'phase', 'status'];
  const normalized = sortParam.toLowerCase() as SortKey;
  
  return validSorts.includes(normalized) ? normalized : 'updated';
}

export function sortToOrderBy(sortKey: SortKey) {
  switch (sortKey) {
    case 'name':
      return { name: 'asc' };
    case 'created':
      return { createdAt: 'desc' };
    case 'updated':
      return { updatedAt: 'desc' };
    case 'status':
      return { status: 'asc' };
    case 'phase':
      // Phase view uses special ordering handled in the component
      return { stage: 'asc' };
    default:
      return { updatedAt: 'desc' };
  }
}




