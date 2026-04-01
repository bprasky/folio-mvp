/**
 * Types for Phase 3 Project-Level Actions
 */

export interface ProjectProductPricingEntry {
  id: string;
  projectId: string;
  productId: string;
  roomId: string | null;

  // Pricing
  unitPriceTrade: number | null;
  unitPriceRetail: number | null;
  quantity: number;
  unit: string | null;

  // Quote metadata
  quotedByName: string | null;
  quotedAt: string | null;
  validThrough: string | null;
  quoteSource: string;

  // Lead time + availability
  leadTimeWeeks: number | null;
  availability: string | null;
  availabilityNote: string | null;

  // Status
  status: PricingStatus;
}

export type PricingStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTED'
  | 'RECEIVED'
  | 'EXPIRED'
  | 'DECLINED';

export type ProductAvailability =
  | 'IN_STOCK'
  | 'MADE_TO_ORDER'
  | 'BACKORDERED'
  | 'DISCONTINUED'
  | 'CONTACT_VENDOR';

export interface BudgetSummary {
  tradeCost: number;
  clientPrice: number;
  margin: number;
  pricedCount: number;
  totalCount: number;
  markupPercent: number;
  byRoom: Array<{
    roomId: string;
    roomName: string;
    tradeCost: number;
    pricedCount: number;
    totalCount: number;
    percentPriced: number;
  }>;
  byVendor: Array<{
    vendorName: string;
    productCount: number;
    pricedCount: number;
    tradeCost: number;
    status: 'all_priced' | 'partial' | 'not_requested';
  }>;
}

export interface NeedsAttentionItem {
  type: 'deadline' | 'pending_quote' | 'pending_sample' | 'discontinued';
  productName: string;
  vendorName: string;
  roomName: string | null;
  detail: string;
  productId: string;
  daysOld?: number;
}

export const PRICING_STATUS_LABELS: Record<PricingStatus, string> = {
  NOT_REQUESTED: 'No price',
  REQUESTED: 'Quote pending',
  RECEIVED: 'Priced',
  EXPIRED: 'Quote expired',
  DECLINED: 'Declined',
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  IN_STOCK: 'In Stock',
  MADE_TO_ORDER: 'Made to Order',
  BACKORDERED: 'Backordered',
  DISCONTINUED: 'Discontinued',
  CONTACT_VENDOR: 'Contact Vendor',
};
