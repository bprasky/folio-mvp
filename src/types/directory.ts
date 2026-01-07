/**
 * Type definitions for designer vendor directory
 */

export interface DirectoryEntry {
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
}

export type SortField = 
  | 'productName' 
  | 'productBrand' 
  | 'category' 
  | 'lastUsedAt' 
  | 'tagCount' 
  | 'projectCount';

export type SortDirection = 'asc' | 'desc';

export interface DirectoryFilters {
  vendor?: string;
  project?: string;
  room?: string;
  category?: string;
  search?: string;
}

export interface DirectoryStats {
  totalProducts: number;
  totalVendors: number;
  totalProjects: number;
}

