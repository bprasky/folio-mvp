/**
 * Vendor Boost System
 *
 * Testimonial marketplace for designer-vendor mentions.
 * When a designer gives a positive vendor mention in an interview,
 * the vendor can choose to boost that testimonial for prominent placement.
 */

export {
  createBoostOpportunities,
  getVendorPendingOpportunities,
  getBoostOpportunityForReview,
  canVendorBoost,
  markOpportunityViewed,
  countVendorActiveOpportunities,
} from './createOpportunity';

export {
  notifyVendorOfBoostOpportunity,
  notifyDesignerOfBoost,
  processPendingOpportunities,
} from './notifyVendor';

export type { CreateBoostOpportunityParams } from './createOpportunity';
