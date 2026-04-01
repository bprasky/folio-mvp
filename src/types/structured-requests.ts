/**
 * Structured request payload types for Sourcebook actions.
 * Stored as JSON in Conversation.structuredData.
 */

export interface SampleRequestPayload {
  type: 'SAMPLE_REQUEST';
  productId: string;
  productName: string;
  vendorName: string;
  finishOrColorway?: string;
  shippingAddress?: string;
  designerNote?: string;
}

export interface QuoteRequestPayload {
  type: 'QUOTE_REQUEST';
  productId: string;
  productName: string;
  vendorName: string;
  projectId?: string;
  projectName?: string;
  quantity: number;
  timeline: 'urgent' | '2-4_weeks' | 'flexible';
  notes?: string;
}

export type StructuredRequestPayload = SampleRequestPayload | QuoteRequestPayload;

export interface RepResolutionResult {
  status: 'DIRECT_REP' | 'ORG_MEMBERS' | 'NO_REP';
  rep?: { userId: string; name: string; profileImage: string | null };
  orgMembers?: Array<{ userId: string; name: string; role: string; profileImage: string | null }>;
  vendorOrgId?: string;
  vendorOrgName?: string;
}

export const TIMELINE_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  '2-4_weeks': '2\u20134 weeks',
  flexible: 'Flexible',
};

export const CATEGORY_LABELS: Record<string, string> = {
  SAMPLE_REQUEST: 'Sample Request',
  QUOTE_REQUEST: 'Quote Request',
  REORDER_REQUEST: 'Reorder Request',
  COLLABORATION: 'Collaboration',
  GENERAL: 'General',
};

export const CATEGORY_ICONS: Record<string, string> = {
  SAMPLE_REQUEST: '\uD83D\uDCE6',
  QUOTE_REQUEST: '\uD83D\uDCB0',
  REORDER_REQUEST: '\uD83D\uDD04',
  COLLABORATION: '\uD83E\uDD1D',
  GENERAL: '\uD83D\uDCAC',
};
