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
  /** Set when a preferred rep is found from imported contacts (off-platform) */
  preferredContact?: { name: string; email: string };
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
  LEAD_TIME_REQUEST: 'Lead Time',
  PHOTO_REQUEST: 'Photos/Tearsheets',
  SPEC_REQUEST: 'Specs/Tech Data',
  COLLABORATION: 'Collaboration',
  GENERAL: 'General',
};

export const CATEGORY_ICONS: Record<string, string> = {
  SAMPLE_REQUEST: '\uD83D\uDCE6',
  QUOTE_REQUEST: '\uD83D\uDCB0',
  REORDER_REQUEST: '\uD83D\uDD04',
  LEAD_TIME_REQUEST: '\u23F1\uFE0F',
  PHOTO_REQUEST: '\uD83D\uDCF8',
  SPEC_REQUEST: '\uD83D\uDCCB',
  COLLABORATION: '\uD83E\uDD1D',
  GENERAL: '\uD83D\uDCAC',
  FOLIO_EMAIL: '\u2709\uFE0F',
};

/** Request types available as checkboxes in the compose flow */
export const REQUEST_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'SAMPLE_REQUEST', label: 'Sample' },
  { value: 'QUOTE_REQUEST', label: 'Quote/Pricing' },
  { value: 'LEAD_TIME_REQUEST', label: 'Lead Time' },
  { value: 'PHOTO_REQUEST', label: 'Photos/Tearsheets' },
  { value: 'SPEC_REQUEST', label: 'Specs/Tech Data' },
];

/** Result from the email send API */
export interface EmailSendResult {
  threadId: string;
  conversationId: string;
  sent: boolean;
}
