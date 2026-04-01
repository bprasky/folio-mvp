/**
 * Type definitions for designer Sourcebook (private product catalog)
 */

export interface SourcebookEntry {
  productId: string;
  productName: string;
  productBrand: string | null;
  productCategory: string | null;
  productImageUrl: string | null;

  projects: Array<{
    projectId: string;
    projectTitle: string;
    roomName: string | null;
  }>;

  repEmail: string | null;
  repName: string | null;

  lastUsedAt: Date;
  tagCount: number;

  // Sourcebook-specific fields (from SourcebookEntry model, lazy-created)
  sourcebookEntryId: string | null;
  notes: string | null;
  archived: boolean;
}

export type SourcebookSortField =
  | 'productName'
  | 'productBrand'
  | 'category'
  | 'lastUsedAt'
  | 'tagCount'
  | 'projectCount';

export type SortDirection = 'asc' | 'desc';

export interface SourcebookFilters {
  vendor?: string;
  project?: string;
  room?: string;
  category?: string;
  search?: string;
  archived?: boolean;
}

export interface SourcebookStats {
  totalProducts: number;
  totalVendors: number;
  totalProjects: number;
  archivedCount: number;
}
