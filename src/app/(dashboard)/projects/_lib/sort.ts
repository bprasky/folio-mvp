export type SortKey =
  | 'phase'
  | 'updated_at'
  | 'created_at'
  | 'budget_band'
  | 'project_type'
  | 'client_type'
  | 'region_state'
  | 'city'
  | 'title';

export const DEFAULT_SORT: SortKey = 'phase';

export function normalizeSort(input: string | null | undefined): SortKey {
  const allowed = new Set<SortKey>([
    'phase', 'updated_at', 'created_at', 'budget_band', 'project_type', 'client_type', 'region_state', 'city', 'title'
  ]);
  return allowed.has(input as SortKey) ? (input as SortKey) : DEFAULT_SORT;
}

// Map UI sort key → Prisma orderBy or grouping mode
export function sortToOrderBy(sort: SortKey) {
  switch (sort) {
    case 'updated_at':   
      return [{ updatedAt: 'desc' }, { name: 'asc' }];
    case 'created_at':   
      return [{ createdAt: 'desc' }, { name: 'asc' }];
    case 'budget_band':  
      return [{ budgetBand: 'asc' }, { updatedAt: 'desc' }];
    case 'project_type': 
      return [{ projectType: 'asc' }, { updatedAt: 'desc' }];
    case 'client_type':  
      return [{ clientType: 'asc' }, { updatedAt: 'desc' }];
    case 'region_state': 
      return [{ regionState: 'asc' }, { city: 'asc' }, { updatedAt: 'desc' }];
    case 'city':         
      return [{ city: 'asc' }, { updatedAt: 'desc' }];
    case 'title':        
      return [{ name: 'asc' }];
    case 'phase':
    default:
      return [{ stage: 'asc' }, { updatedAt: 'desc' }];
  }
}

// Get sort options that are currently available vs. planned
export const AVAILABLE_SORT_OPTIONS: Array<{key: SortKey, label: string, available: boolean}> = [
  { key: 'phase', label: 'Project Phase', available: true },
  { key: 'updated_at', label: 'Last Updated', available: true },
  { key: 'created_at', label: 'Date Created', available: true },
  { key: 'title', label: 'Project Name', available: true },
  { key: 'budget_band', label: 'Budget Range', available: true },
  { key: 'project_type', label: 'Project Type', available: true },
  { key: 'client_type', label: 'Client Type', available: true },
  { key: 'region_state', label: 'Region/State', available: true },
  { key: 'city', label: 'City', available: true },
];

// Get only available sort options
export function getAvailableSortOptions() {
  return AVAILABLE_SORT_OPTIONS.filter(option => option.available);
}
